import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import {
  formatHealthSignalValue,
  getHealthSignalColor,
  HEALTH_BAR_SEGMENT_COUNT,
  HEALTH_SIGNAL_DURATION_MS,
  HEALTH_SIGNAL_GLYPHS,
  HEALTH_SIGNAL_GLYPHS_PER_ROW,
  HEALTH_SIGNAL_STACK_SIZE,
} from "../../game/overheadStatus";
import type { ActiveEffect } from "../../game/types";

const BAR_WIDTH = 2.49;
const BAR_HEIGHT = 0.42;
const EFFECT_SIZE = 0.58;
const EFFECT_SPACING = 0.64;
const SIGNAL_GLYPH_WIDTH = 0.4;
const SIGNAL_GLYPH_HEIGHT = 0.54;
const SIGNAL_GLYPH_SPACING = 0.3;
const SIGNAL_BASE_OFFSET_Y = 1.15;
const SIGNAL_ROW_SPACING = 0.48;
const SIGNAL_ATLAS_CELL_WIDTH_PX = 64;
const SIGNAL_ATLAS_CELL_HEIGHT_PX = 80;
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

const SIGNAL_VERTEX_SHADER = `
  attribute vec3 instanceWorldPosition;
  attribute float instanceOffsetX;
  attribute float instanceOffsetY;
  attribute float instanceGlyph;
  attribute vec3 instanceSignalColor;
  attribute float instanceVisible;
  varying vec2 vUv;
  varying float vGlyph;
  varying vec3 vSignalColor;
  varying float vVisible;

  void main() {
    vUv = uv;
    vGlyph = instanceGlyph;
    vSignalColor = instanceSignalColor;
    vVisible = instanceVisible;
    vec4 center = modelViewMatrix * vec4(instanceWorldPosition, 1.0);
    center.xy += vec2(instanceOffsetX, instanceOffsetY) + position.xy;
    gl_Position = projectionMatrix * center;
  }
`;

const SIGNAL_FRAGMENT_SHADER = `
  uniform sampler2D glyphAtlas;
  varying vec2 vUv;
  varying float vGlyph;
  varying vec3 vSignalColor;
  varying float vVisible;

  void main() {
    if (vVisible < 0.5) discard;
    float atlasWidth = ${HEALTH_SIGNAL_GLYPHS.length}.0;
    vec2 atlasUv = vec2((vGlyph + vUv.x) / atlasWidth, vUv.y);
    vec4 glyph = texture2D(glyphAtlas, atlasUv);
    if (glyph.a < 0.02) discard;
    gl_FragColor = vec4(glyph.rgb * vSignalColor, glyph.a);
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
  readonly signalPosition: InstancedBufferAttribute;
  readonly signalOffsetX: InstancedBufferAttribute;
  readonly signalOffsetY: InstancedBufferAttribute;
  readonly signalGlyph: InstancedBufferAttribute;
  readonly signalColor: InstancedBufferAttribute;
  readonly signalVisible: InstancedBufferAttribute;
  private readonly registrations = new Map<string, OverheadStatusRegistration>();
  private readonly freeSlots: number[] = [];
  private readonly signalDeltas: Float64Array;
  private readonly signalExpiresAtMs: Float64Array;
  private readonly signalRowsActive: Uint8Array;
  private readonly signalEntitiesActive: Uint8Array;
  private readonly activeSignalSlots: number[] = [];
  private dirty = true;
  private signalDirty = false;

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
    const signalRowCapacity = capacity * HEALTH_SIGNAL_STACK_SIZE;
    const signalGlyphCapacity =
      signalRowCapacity * HEALTH_SIGNAL_GLYPHS_PER_ROW;
    this.signalPosition = new InstancedBufferAttribute(
      new Float32Array(signalGlyphCapacity * 3),
      3,
    );
    this.signalOffsetX = new InstancedBufferAttribute(
      new Float32Array(signalGlyphCapacity),
      1,
    );
    this.signalOffsetY = new InstancedBufferAttribute(
      new Float32Array(signalGlyphCapacity),
      1,
    );
    this.signalGlyph = new InstancedBufferAttribute(
      new Float32Array(signalGlyphCapacity),
      1,
    );
    this.signalColor = new InstancedBufferAttribute(
      new Float32Array(signalGlyphCapacity * 3),
      3,
    );
    this.signalVisible = new InstancedBufferAttribute(
      new Float32Array(signalGlyphCapacity),
      1,
    );
    this.signalDeltas = new Float64Array(signalRowCapacity);
    this.signalExpiresAtMs = new Float64Array(signalRowCapacity);
    this.signalRowsActive = new Uint8Array(signalRowCapacity);
    this.signalEntitiesActive = new Uint8Array(capacity);

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

    if (this.signalEntitiesActive[slot] === 1) {
      this.signalDirty =
        this.writeHealthSignalPositions(slot, update.x, update.y, update.z) ||
        this.signalDirty;
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

  pushHealthSignal(
    receiverId: string,
    healthDelta: number,
    timestampMs = performance.now(),
  ): boolean {
    const registration = this.registrations.get(receiverId);

    if (!registration || !Number.isFinite(healthDelta)) {
      return false;
    }

    const safeTimestampMs = Number.isFinite(timestampMs)
      ? timestampMs
      : performance.now();
    this.expireHealthSignals(safeTimestampMs);
    const rowBase = registration.slot * HEALTH_SIGNAL_STACK_SIZE;

    for (let row = HEALTH_SIGNAL_STACK_SIZE - 1; row > 0; row -= 1) {
      const destination = rowBase + row;
      const source = destination - 1;
      this.signalDeltas[destination] = this.signalDeltas[source];
      this.signalExpiresAtMs[destination] = this.signalExpiresAtMs[source];
      this.signalRowsActive[destination] = this.signalRowsActive[source];
    }

    this.signalDeltas[rowBase] = healthDelta;
    this.signalExpiresAtMs[rowBase] =
      safeTimestampMs + HEALTH_SIGNAL_DURATION_MS;
    this.signalRowsActive[rowBase] = 1;

    if (this.signalEntitiesActive[registration.slot] === 0) {
      this.signalEntitiesActive[registration.slot] = 1;
      this.activeSignalSlots.push(registration.slot);
    }

    this.writeHealthSignalRows(registration.slot);
    this.signalDirty = true;
    return true;
  }

  expireHealthSignals(timestampMs = performance.now()): void {
    if (!Number.isFinite(timestampMs)) {
      return;
    }

    for (
      let activeIndex = this.activeSignalSlots.length - 1;
      activeIndex >= 0;
      activeIndex -= 1
    ) {
      const slot = this.activeSignalSlots[activeIndex];
      const rowBase = slot * HEALTH_SIGNAL_STACK_SIZE;
      let hasExpiredSignal = false;

      for (let row = 0; row < HEALTH_SIGNAL_STACK_SIZE; row += 1) {
        const index = rowBase + row;

        if (
          this.signalRowsActive[index] === 1 &&
          this.signalExpiresAtMs[index] <= timestampMs
        ) {
          hasExpiredSignal = true;
          break;
        }
      }

      if (!hasExpiredSignal) {
        continue;
      }

      let writeRow = 0;

      for (let readRow = 0; readRow < HEALTH_SIGNAL_STACK_SIZE; readRow += 1) {
        const source = rowBase + readRow;

        if (
          this.signalRowsActive[source] === 0 ||
          this.signalExpiresAtMs[source] <= timestampMs
        ) {
          continue;
        }

        const destination = rowBase + writeRow;

        if (destination !== source) {
          this.signalDeltas[destination] = this.signalDeltas[source];
          this.signalExpiresAtMs[destination] =
            this.signalExpiresAtMs[source];
          this.signalRowsActive[destination] = 1;
        }

        writeRow += 1;
      }

      for (let row = writeRow; row < HEALTH_SIGNAL_STACK_SIZE; row += 1) {
        const index = rowBase + row;
        this.signalDeltas[index] = 0;
        this.signalExpiresAtMs[index] = 0;
        this.signalRowsActive[index] = 0;
      }

      this.writeHealthSignalRows(slot);

      if (writeRow === 0) {
        this.signalEntitiesActive[slot] = 0;
        const finalIndex = this.activeSignalSlots.length - 1;
        this.activeSignalSlots[activeIndex] =
          this.activeSignalSlots[finalIndex];
        this.activeSignalSlots.pop();
      }

      this.signalDirty = true;
    }
  }

  unregister(registration: OverheadStatusRegistration): void {
    if (this.registrations.get(registration.id) !== registration) {
      return;
    }

    this.registrations.delete(registration.id);
    this.writeScalar(this.barVisible, registration.slot, 0);
    this.writeScalar(this.effectVisible, registration.slot * 2, 0);
    this.writeScalar(this.effectVisible, registration.slot * 2 + 1, 0);
    this.clearHealthSignals(registration.slot);
    this.freeSlots.push(registration.slot);
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty && !this.signalDirty) {
      return;
    }

    if (this.dirty) {
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

    if (this.signalDirty) {
      this.signalPosition.needsUpdate = true;
      this.signalOffsetX.needsUpdate = true;
      this.signalOffsetY.needsUpdate = true;
      this.signalGlyph.needsUpdate = true;
      this.signalColor.needsUpdate = true;
      this.signalVisible.needsUpdate = true;
      this.signalDirty = false;
    }
  }

  getCapacity(): number {
    return this.capacity;
  }

  private writeHealthSignalRows(slot: number): void {
    const rowBase = slot * HEALTH_SIGNAL_STACK_SIZE;
    const x = this.barPosition.getX(slot);
    const y = this.barPosition.getY(slot);
    const z = this.barPosition.getZ(slot);

    for (let row = 0; row < HEALTH_SIGNAL_STACK_SIZE; row += 1) {
      const signalIndex = rowBase + row;
      const glyphBase = signalIndex * HEALTH_SIGNAL_GLYPHS_PER_ROW;

      if (this.signalRowsActive[signalIndex] === 0) {
        for (
          let glyph = 0;
          glyph < HEALTH_SIGNAL_GLYPHS_PER_ROW;
          glyph += 1
        ) {
          this.writeScalar(this.signalVisible, glyphBase + glyph, 0);
        }

        continue;
      }

      const healthDelta = this.signalDeltas[signalIndex];
      const value = formatHealthSignalValue(healthDelta);
      const glyphCount = Math.min(
        value.length,
        HEALTH_SIGNAL_GLYPHS_PER_ROW,
      );
      const offsetStart = ((glyphCount - 1) * -SIGNAL_GLYPH_SPACING) / 2;
      colorScratch.set(getHealthSignalColor(healthDelta));

      for (
        let glyph = 0;
        glyph < HEALTH_SIGNAL_GLYPHS_PER_ROW;
        glyph += 1
      ) {
        const glyphSlot = glyphBase + glyph;

        if (glyph >= glyphCount) {
          this.writeScalar(this.signalVisible, glyphSlot, 0);
          continue;
        }

        const atlasGlyph = HEALTH_SIGNAL_GLYPHS.indexOf(value.charAt(glyph));
        this.writeVector(this.signalPosition, glyphSlot, x, y, z);
        this.writeScalar(
          this.signalOffsetX,
          glyphSlot,
          offsetStart + glyph * SIGNAL_GLYPH_SPACING,
        );
        this.writeScalar(
          this.signalOffsetY,
          glyphSlot,
          SIGNAL_BASE_OFFSET_Y + row * SIGNAL_ROW_SPACING,
        );
        this.writeScalar(this.signalGlyph, glyphSlot, atlasGlyph);
        this.writeVector(
          this.signalColor,
          glyphSlot,
          colorScratch.r,
          colorScratch.g,
          colorScratch.b,
        );
        this.writeScalar(this.signalVisible, glyphSlot, 1);
      }
    }
  }

  private writeHealthSignalPositions(
    slot: number,
    x: number,
    y: number,
    z: number,
  ): boolean {
    const glyphBase =
      slot * HEALTH_SIGNAL_STACK_SIZE * HEALTH_SIGNAL_GLYPHS_PER_ROW;
    const glyphEnd =
      glyphBase + HEALTH_SIGNAL_STACK_SIZE * HEALTH_SIGNAL_GLYPHS_PER_ROW;
    let changed = false;

    for (let glyph = glyphBase; glyph < glyphEnd; glyph += 1) {
      if (this.signalVisible.getX(glyph) < 0.5) {
        continue;
      }

      changed =
        this.writeVector(this.signalPosition, glyph, x, y, z) || changed;
    }

    return changed;
  }

  private clearHealthSignals(slot: number): void {
    const rowBase = slot * HEALTH_SIGNAL_STACK_SIZE;
    let changed = false;

    for (let row = 0; row < HEALTH_SIGNAL_STACK_SIZE; row += 1) {
      const signalIndex = rowBase + row;
      const glyphBase = signalIndex * HEALTH_SIGNAL_GLYPHS_PER_ROW;
      this.signalDeltas[signalIndex] = 0;
      this.signalExpiresAtMs[signalIndex] = 0;
      this.signalRowsActive[signalIndex] = 0;

      for (
        let glyph = 0;
        glyph < HEALTH_SIGNAL_GLYPHS_PER_ROW;
        glyph += 1
      ) {
        changed =
          this.writeScalar(this.signalVisible, glyphBase + glyph, 0) || changed;
      }
    }

    if (this.signalEntitiesActive[slot] === 1) {
      this.signalEntitiesActive[slot] = 0;

      for (
        let index = this.activeSignalSlots.length - 1;
        index >= 0;
        index -= 1
      ) {
        if (this.activeSignalSlots[index] !== slot) {
          continue;
        }

        const finalIndex = this.activeSignalSlots.length - 1;
        this.activeSignalSlots[index] = this.activeSignalSlots[finalIndex];
        this.activeSignalSlots.pop();
        break;
      }
    }

    this.signalDirty = this.signalDirty || changed;
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

function createHealthSignalAtlas(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SIGNAL_ATLAS_CELL_WIDTH_PX * HEALTH_SIGNAL_GLYPHS.length;
  canvas.height = SIGNAL_ATLAS_CELL_HEIGHT_PX;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("A 2D canvas context is required for health signals.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '700 54px "Cascadia Mono", "Consolas", monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.strokeStyle = "#071018";
  context.lineWidth = 9;
  context.fillStyle = "#ffffff";

  for (let index = 0; index < HEALTH_SIGNAL_GLYPHS.length; index += 1) {
    const glyph = HEALTH_SIGNAL_GLYPHS.charAt(index);
    const x =
      index * SIGNAL_ATLAS_CELL_WIDTH_PX +
      SIGNAL_ATLAS_CELL_WIDTH_PX / 2;
    const y = SIGNAL_ATLAS_CELL_HEIGHT_PX * 0.54;
    context.strokeText(glyph, x, y);
    context.fillText(glyph, x, y);
  }

  const texture = new CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
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
    const signalGeometry = createGeometry(
      SIGNAL_GLYPH_WIDTH,
      SIGNAL_GLYPH_HEIGHT,
      registry.getCapacity() *
        HEALTH_SIGNAL_STACK_SIZE *
        HEALTH_SIGNAL_GLYPHS_PER_ROW,
    );
    signalGeometry.setAttribute(
      "instanceWorldPosition",
      registry.signalPosition,
    );
    signalGeometry.setAttribute("instanceOffsetX", registry.signalOffsetX);
    signalGeometry.setAttribute("instanceOffsetY", registry.signalOffsetY);
    signalGeometry.setAttribute("instanceGlyph", registry.signalGlyph);
    signalGeometry.setAttribute(
      "instanceSignalColor",
      registry.signalColor,
    );
    signalGeometry.setAttribute("instanceVisible", registry.signalVisible);
    const signalAtlas = createHealthSignalAtlas();
    const signalMaterial = new ShaderMaterial({
      uniforms: { glyphAtlas: { value: signalAtlas } },
      vertexShader: SIGNAL_VERTEX_SHADER,
      fragmentShader: SIGNAL_FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    return {
      barGeometry,
      barMaterial,
      effectGeometry,
      effectMaterial,
      signalGeometry,
      signalMaterial,
      signalAtlas,
    };
  }, [registry]);

  useEffect(
    () => () => {
      resources.barGeometry.dispose();
      resources.barMaterial.dispose();
      resources.effectGeometry.dispose();
      resources.effectMaterial.dispose();
      resources.signalGeometry.dispose();
      resources.signalMaterial.dispose();
      resources.signalAtlas.dispose();
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
      <mesh
        geometry={resources.signalGeometry}
        material={resources.signalMaterial}
        frustumCulled={false}
        renderOrder={30}
      />
    </>
  );
}
