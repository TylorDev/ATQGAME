import { useEffect, useMemo } from "react";
import {
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { HEALTH_BAR_SEGMENT_COUNT } from "../../game/overheadStatus";
import type { ActiveEffect } from "../../game/types";

const BAR_WIDTH = 2.49;
const BAR_HEIGHT = 0.42;
const EFFECT_SIZE = 0.58;
const EFFECT_SPACING = 0.64;
const DEFAULT_CAPACITY = 128;
const colorScratch = new Color();

export interface OverheadStatusRegistration {
  readonly id: string;
  readonly slot: number;
}

export interface OverheadStatusUpdate {
  x: number;
  y: number;
  z: number;
  currentHealth: number;
  maximumHealth: number;
  healthColor?: string;
  effects: readonly ActiveEffect[];
}

const BAR_VERTEX_SHADER = `
  attribute vec3 instanceWorldPosition;
  attribute float instanceHealth;
  attribute vec3 instanceHealthColor;
  attribute float instanceVisible;
  varying vec2 vUv;
  varying float vHealth;
  varying vec3 vHealthColor;
  varying float vVisible;

  void main() {
    vUv = uv;
    vHealth = instanceHealth;
    vHealthColor = instanceHealthColor;
    vVisible = instanceVisible;
    vec4 center = modelViewMatrix * vec4(instanceWorldPosition, 1.0);
    center.xy += position.xy;
    gl_Position = projectionMatrix * center;
  }
`;

const BAR_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying float vHealth;
  varying vec3 vHealthColor;
  varying float vVisible;

  void main() {
    if (vVisible < 0.5) discard;
    const float marginX = 0.028;
    const float marginY = 0.17;
    vec3 borderColor = vec3(0.039, 0.067, 0.09);
    vec3 emptyColor = vec3(0.09, 0.133, 0.169);

    if (vUv.x < marginX || vUv.x > 1.0 - marginX || vUv.y < marginY || vUv.y > 1.0 - marginY) {
      gl_FragColor = vec4(borderColor, 0.92);
      return;
    }

    float localX = (vUv.x - marginX) / (1.0 - marginX * 2.0);
    float segmentDistance = abs(fract(localX * ${HEALTH_BAR_SEGMENT_COUNT}.0) - 0.5);
    vec3 color = localX <= vHealth ? vHealthColor : emptyColor;

    if (segmentDistance > 0.475) {
      color = vec3(0.568, 0.749, 0.827);
    }

    gl_FragColor = vec4(color, 0.98);
  }
`;

const EFFECT_VERTEX_SHADER = `
  attribute vec3 instanceWorldPosition;
  attribute float instanceOffsetX;
  attribute float instanceProgress;
  attribute float instanceType;
  attribute float instanceVisible;
  varying vec2 vUv;
  varying float vProgress;
  varying float vType;
  varying float vVisible;

  void main() {
    vUv = uv;
    vProgress = instanceProgress;
    vType = instanceType;
    vVisible = instanceVisible;
    vec4 center = modelViewMatrix * vec4(instanceWorldPosition, 1.0);
    center.xy += vec2(instanceOffsetX, 0.58) + position.xy;
    gl_Position = projectionMatrix * center;
  }
`;

const EFFECT_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying float vProgress;
  varying float vType;
  varying float vVisible;

  void main() {
    if (vVisible < 0.5) discard;
    vec2 centered = vUv - vec2(0.5);
    float distanceToCenter = length(centered);
    if (distanceToCenter > 0.5) discard;
    vec3 effectColor = vType < 1.5
      ? vec3(0.259, 0.792, 1.0)
      : vec3(1.0, 0.416, 0.239);
    vec3 color = vec3(0.11, 0.169, 0.208);
    float alpha = 0.92;

    if (distanceToCenter > 0.38) {
      float angle = atan(centered.y, centered.x) + 1.57079632679;
      if (angle < 0.0) angle += 6.28318530718;
      if (angle > vProgress * 6.28318530718) discard;
      color = effectColor;
      alpha = 1.0;
    } else if (distanceToCenter < 0.16) {
      color = vec3(0.945, 0.992, 1.0);
      alpha = 1.0;
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

export class OverheadStatusRegistry {
  readonly barPosition: InstancedBufferAttribute;
  readonly barHealth: InstancedBufferAttribute;
  readonly barColor: InstancedBufferAttribute;
  readonly barVisible: InstancedBufferAttribute;
  readonly effectPosition: InstancedBufferAttribute;
  readonly effectOffset: InstancedBufferAttribute;
  readonly effectProgress: InstancedBufferAttribute;
  readonly effectType: InstancedBufferAttribute;
  readonly effectVisible: InstancedBufferAttribute;
  private readonly registrations = new Map<string, OverheadStatusRegistration>();
  private readonly freeSlots: number[] = [];
  private dirty = true;

  constructor(private readonly capacity = DEFAULT_CAPACITY) {
    this.barPosition = new InstancedBufferAttribute(
      new Float32Array(capacity * 3),
      3,
    );
    this.barHealth = new InstancedBufferAttribute(
      new Float32Array(capacity),
      1,
    );
    this.barColor = new InstancedBufferAttribute(
      new Float32Array(capacity * 3),
      3,
    );
    this.barVisible = new InstancedBufferAttribute(
      new Float32Array(capacity),
      1,
    );
    const effectCapacity = capacity * 2;
    this.effectPosition = new InstancedBufferAttribute(
      new Float32Array(effectCapacity * 3),
      3,
    );
    this.effectOffset = new InstancedBufferAttribute(
      new Float32Array(effectCapacity),
      1,
    );
    this.effectProgress = new InstancedBufferAttribute(
      new Float32Array(effectCapacity),
      1,
    );
    this.effectType = new InstancedBufferAttribute(
      new Float32Array(effectCapacity),
      1,
    );
    this.effectVisible = new InstancedBufferAttribute(
      new Float32Array(effectCapacity),
      1,
    );

    for (let slot = capacity - 1; slot >= 0; slot -= 1) {
      this.freeSlots.push(slot);
    }
  }

  register(id: string): OverheadStatusRegistration {
    const existing = this.registrations.get(id);

    if (existing) {
      return existing;
    }

    const slot = this.freeSlots.pop();

    if (slot === undefined) {
      throw new Error(`Overhead status capacity (${this.capacity}) exceeded.`);
    }

    const registration = { id, slot };
    this.registrations.set(id, registration);
    this.writeScalar(this.barVisible, slot, 1);
    this.writeScalar(this.barHealth, slot, 1);
    this.writeColor(slot, "#ffffff");
    this.dirty = true;
    return registration;
  }

  update(
    registration: OverheadStatusRegistration,
    update: OverheadStatusUpdate,
  ): void {
    if (this.registrations.get(registration.id) !== registration) {
      return;
    }

    const { slot } = registration;
    let changed = this.writeVector(
      this.barPosition,
      slot,
      update.x,
      update.y,
      update.z,
    );
    changed = this.writeScalar(
      this.barHealth,
      slot,
      update.maximumHealth > 0
        ? Math.min(Math.max(update.currentHealth / update.maximumHealth, 0), 1)
        : 0,
    ) || changed;
    changed = this.writeScalar(this.barVisible, slot, 1) || changed;

    if (update.healthColor) {
      changed = this.writeColor(slot, update.healthColor) || changed;
    }

    let supportedCount = 0;

    for (
      let index = 0;
      index < update.effects.length && supportedCount < 2;
      index += 1
    ) {
      const effect = update.effects[index];

      if (effect.id !== "speed-boost" && effect.id !== "burning") {
        continue;
      }

      const effectSlot = slot * 2 + supportedCount;
      changed = this.writeVector(
        this.effectPosition,
        effectSlot,
        update.x,
        update.y,
        update.z,
      ) || changed;
      changed = this.writeScalar(
        this.effectProgress,
        effectSlot,
        Math.min(Math.max(effect.timerProgress, 0), 1),
      ) || changed;
      changed = this.writeScalar(
        this.effectType,
        effectSlot,
        effect.id === "speed-boost" ? 1 : 2,
      ) || changed;
      changed = this.writeScalar(this.effectVisible, effectSlot, 1) || changed;
      supportedCount += 1;
    }

    for (let index = 0; index < 2; index += 1) {
      const effectSlot = slot * 2 + index;
      changed = this.writeScalar(
        this.effectVisible,
        effectSlot,
        index < supportedCount ? 1 : 0,
      ) || changed;
      changed = this.writeScalar(
        this.effectOffset,
        effectSlot,
        supportedCount > 0
          ? ((supportedCount - 1) * -EFFECT_SPACING) / 2 +
              index * EFFECT_SPACING
          : 0,
      ) || changed;
    }

    this.dirty = this.dirty || changed;
  }

  unregister(registration: OverheadStatusRegistration): void {
    if (this.registrations.get(registration.id) !== registration) {
      return;
    }

    this.registrations.delete(registration.id);
    this.writeScalar(this.barVisible, registration.slot, 0);
    this.writeScalar(this.effectVisible, registration.slot * 2, 0);
    this.writeScalar(this.effectVisible, registration.slot * 2 + 1, 0);
    this.freeSlots.push(registration.slot);
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) {
      return;
    }

    this.barPosition.needsUpdate = true;
    this.barHealth.needsUpdate = true;
    this.barColor.needsUpdate = true;
    this.barVisible.needsUpdate = true;
    this.effectPosition.needsUpdate = true;
    this.effectOffset.needsUpdate = true;
    this.effectProgress.needsUpdate = true;
    this.effectType.needsUpdate = true;
    this.effectVisible.needsUpdate = true;
    this.dirty = false;
  }

  getCapacity(): number {
    return this.capacity;
  }

  private writeColor(slot: number, color: string): boolean {
    colorScratch.set(color);
    return this.writeVector(
      this.barColor,
      slot,
      colorScratch.r,
      colorScratch.g,
      colorScratch.b,
    );
  }

  private writeScalar(
    attribute: InstancedBufferAttribute,
    index: number,
    value: number,
  ): boolean {
    if (attribute.getX(index) === value) {
      return false;
    }

    attribute.setX(index, value);
    return true;
  }

  private writeVector(
    attribute: InstancedBufferAttribute,
    index: number,
    x: number,
    y: number,
    z: number,
  ): boolean {
    if (
      attribute.getX(index) === x &&
      attribute.getY(index) === y &&
      attribute.getZ(index) === z
    ) {
      return false;
    }

    attribute.setXYZ(index, x, y, z);
    return true;
  }
}

function createGeometry(
  width: number,
  height: number,
  instanceCount: number,
): InstancedBufferGeometry {
  const plane = new PlaneGeometry(width, height);
  const geometry = new InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  geometry.setAttribute("uv", plane.getAttribute("uv"));
  geometry.instanceCount = instanceCount;
  return geometry;
}

interface OverheadStatusLayerProps {
  registry: OverheadStatusRegistry;
}

export function OverheadStatusLayer({ registry }: OverheadStatusLayerProps) {
  const resources = useMemo(() => {
    const barGeometry = createGeometry(
      BAR_WIDTH,
      BAR_HEIGHT,
      registry.getCapacity(),
    );
    barGeometry.setAttribute("instanceWorldPosition", registry.barPosition);
    barGeometry.setAttribute("instanceHealth", registry.barHealth);
    barGeometry.setAttribute("instanceHealthColor", registry.barColor);
    barGeometry.setAttribute("instanceVisible", registry.barVisible);
    const barMaterial = new ShaderMaterial({
      vertexShader: BAR_VERTEX_SHADER,
      fragmentShader: BAR_FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const effectGeometry = createGeometry(
      EFFECT_SIZE,
      EFFECT_SIZE,
      registry.getCapacity() * 2,
    );
    effectGeometry.setAttribute(
      "instanceWorldPosition",
      registry.effectPosition,
    );
    effectGeometry.setAttribute("instanceOffsetX", registry.effectOffset);
    effectGeometry.setAttribute("instanceProgress", registry.effectProgress);
    effectGeometry.setAttribute("instanceType", registry.effectType);
    effectGeometry.setAttribute("instanceVisible", registry.effectVisible);
    const effectMaterial = new ShaderMaterial({
      vertexShader: EFFECT_VERTEX_SHADER,
      fragmentShader: EFFECT_FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    return { barGeometry, barMaterial, effectGeometry, effectMaterial };
  }, [registry]);

  useEffect(
    () => () => {
      resources.barGeometry.dispose();
      resources.barMaterial.dispose();
      resources.effectGeometry.dispose();
      resources.effectMaterial.dispose();
    },
    [resources],
  );

  return (
    <>
      <mesh
        geometry={resources.barGeometry}
        material={resources.barMaterial}
        frustumCulled={false}
        renderOrder={10}
      />
      <mesh
        geometry={resources.effectGeometry}
        material={resources.effectMaterial}
        frustumCulled={false}
        renderOrder={20}
      />
    </>
  );
}
