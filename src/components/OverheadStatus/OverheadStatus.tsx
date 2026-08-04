import { forwardRef, useImperativeHandle, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  Shape,
} from "three";
import {
  HEALTH_BAR_SEGMENT_COUNT,
  getHealthFillRatio,
} from "@/game/overheadStatus";
import type { ActiveEffect } from "@/game/types";

const BAR_WIDTH = 2.35;
const BAR_HEIGHT = 0.28;
const DIVIDER_WIDTH = 0.05;
const DIVIDER_COLOR = "#91bfd3";
const EFFECT_SPACING = 0.64;
const DARK_SEGMENT_COLOR = "#17222b";
const EFFECT_COLORS = {
  "speed-boost": "#42caff",
  burning: "#ff6a3d",
} as const;

const speedBoostIcon = new Shape();
speedBoostIcon.moveTo(-0.04, 0.19);
speedBoostIcon.lineTo(0.14, 0.19);
speedBoostIcon.lineTo(0.02, 0.035);
speedBoostIcon.lineTo(0.1, 0.035);
speedBoostIcon.lineTo(-0.12, -0.2);
speedBoostIcon.lineTo(-0.035, -0.035);
speedBoostIcon.lineTo(-0.12, -0.035);
speedBoostIcon.closePath();

const burningIcon = new Shape();
burningIcon.moveTo(0, -0.2);
burningIcon.bezierCurveTo(-0.18, -0.07, -0.16, 0.11, -0.04, 0.18);
burningIcon.bezierCurveTo(-0.05, 0.06, 0.04, 0, 0.1, -0.1);
burningIcon.bezierCurveTo(0.19, 0.03, 0.16, 0.18, 0.02, 0.22);
burningIcon.bezierCurveTo(0.19, 0.04, 0.13, -0.12, 0, -0.2);
burningIcon.closePath();

const RING_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform float progress;
  uniform vec3 ringColor;

  void main() {
    vec2 centered = vUv - vec2(0.5);
    float distanceToCenter = length(centered);
    float pi = 3.14159265359;
    float angle = atan(centered.y, centered.x) + pi * 0.5;

    if (angle < 0.0) {
      angle += 2.0 * pi;
    }

    if (distanceToCenter < 0.38 || distanceToCenter > 0.5 || angle > progress * 2.0 * pi) {
      discard;
    }

    gl_FragColor = vec4(ringColor, 1.0);
  }
`;

export interface OverheadStatusUpdate {
  currentHealth: number;
  maximumHealth: number;
  effects: readonly ActiveEffect[];
}

export interface OverheadStatusHandle {
  update: (status: OverheadStatusUpdate) => void;
}

interface OverheadStatusProps {
  position: readonly [number, number, number];
  healthColor: string;
  showEffects?: boolean;
}

interface EffectMedallionHandle {
  update: (effect: ActiveEffect | null, positionX: number) => void;
}

function isSupportedEffect(
  effect: ActiveEffect,
): effect is ActiveEffect & { id: keyof typeof EFFECT_COLORS } {
  return effect.id === "speed-boost" || effect.id === "burning";
}

const EffectMedallion = forwardRef<EffectMedallionHandle>(
  function EffectMedallion(_, ref) {
    const groupRef = useRef<Group>(null);
    const backgroundMaterialRef = useRef<MeshBasicMaterial>(null);
    const ringMaterialRef = useRef<ShaderMaterial>(null);
    const speedBoostIconRef = useRef<Group>(null);
    const burningIconRef = useRef<Group>(null);

    useImperativeHandle(ref, () => ({
      update(effect, positionX) {
        const group = groupRef.current;

        if (!group) {
          return;
        }

        group.visible = effect !== null;
        group.position.x = positionX;

        if (!effect || !isSupportedEffect(effect)) {
          return;
        }

        const color = EFFECT_COLORS[effect.id];
        backgroundMaterialRef.current?.color.set(color);

        if (ringMaterialRef.current) {
          ringMaterialRef.current.uniforms.progress.value = effect.timerProgress;
          ringMaterialRef.current.uniforms.ringColor.value.set(color);
        }

        if (speedBoostIconRef.current) {
          speedBoostIconRef.current.visible = effect.id === "speed-boost";
        }

        if (burningIconRef.current) {
          burningIconRef.current.visible = effect.id === "burning";
        }
      },
    }));

    return (
      <group ref={groupRef} visible={false} position={[0, 0.58, 0.03]}>
        <mesh renderOrder={20}>
          <circleGeometry args={[0.245, 32]} />
          <meshBasicMaterial
            ref={backgroundMaterialRef}
            color="#1c2b35"
            transparent
            opacity={0.92}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.012]} renderOrder={21}>
          <circleGeometry args={[0.29, 48]} />
          <shaderMaterial
            ref={ringMaterialRef}
            vertexShader={RING_VERTEX_SHADER}
            fragmentShader={RING_FRAGMENT_SHADER}
            uniforms={{
              progress: { value: 1 },
              ringColor: { value: new Color(EFFECT_COLORS["speed-boost"]) },
            }}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <group ref={speedBoostIconRef} position={[0, 0, 0.024]}>
          <mesh renderOrder={22}>
            <shapeGeometry args={[speedBoostIcon]} />
            <meshBasicMaterial color="#f1fdff" depthTest={false} depthWrite={false} />
          </mesh>
        </group>
        <group ref={burningIconRef} position={[0, 0, 0.024]} visible={false}>
          <mesh renderOrder={22}>
            <shapeGeometry args={[burningIcon]} />
            <meshBasicMaterial color="#fff2d7" depthTest={false} depthWrite={false} />
          </mesh>
        </group>
      </group>
    );
  },
);

export const OverheadStatus = forwardRef<OverheadStatusHandle, OverheadStatusProps>(
  function OverheadStatus(
    { position, healthColor, showEffects = false },
    ref,
  ) {
    const groupRef = useRef<Group>(null);
    const parentQuaternionRef = useRef(new Quaternion());
    const healthFillMeshRef = useRef<Mesh>(null);
    const effectSlotsRef = useRef<(EffectMedallionHandle | null)[]>([]);
    const healthFillRatioRef = useRef(-1);

    useFrame(({ camera }) => {
      const group = groupRef.current;

      if (!group) {
        return;
      }

      if (!group.parent) {
        group.quaternion.copy(camera.quaternion);
        return;
      }

      group.parent.getWorldQuaternion(parentQuaternionRef.current);
      group.quaternion
        .copy(parentQuaternionRef.current)
        .invert()
        .multiply(camera.quaternion);
    });

    useImperativeHandle(
      ref,
      () => ({
        update(status) {
          const healthFillRatio = getHealthFillRatio(
            status.currentHealth,
            status.maximumHealth,
          );

          if (healthFillRatio !== healthFillRatioRef.current) {
            const fillMesh = healthFillMeshRef.current;

            if (fillMesh) {
              fillMesh.visible = healthFillRatio > 0;
              fillMesh.scale.x = healthFillRatio;
              fillMesh.position.x =
                -BAR_WIDTH / 2 + (BAR_WIDTH * healthFillRatio) / 2;
            }

            healthFillRatioRef.current = healthFillRatio;
          }

          if (!showEffects) {
            return;
          }

          const effects = status.effects.filter(isSupportedEffect).slice(0, 2);

          for (let index = 0; index < effectSlotsRef.current.length; index += 1) {
            const effect = effects[index] ?? null;
            const positionX =
              ((effects.length - 1) * -EFFECT_SPACING) / 2 +
              index * EFFECT_SPACING;

            effectSlotsRef.current[index]?.update(effect, positionX);
          }
        },
      }),
      [healthColor, showEffects],
    );

    return (
      <group ref={groupRef} position={position}>
        <mesh position={[0, 0, -0.012]} renderOrder={10}>
          <planeGeometry args={[BAR_WIDTH + 0.14, BAR_HEIGHT + 0.14]} />
          <meshBasicMaterial
            color="#0a1117"
            transparent
            opacity={0.9}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh renderOrder={11}>
          <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
          <meshBasicMaterial
            color={DARK_SEGMENT_COLOR}
            transparent
            opacity={0.98}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh
          ref={healthFillMeshRef}
          position={[0, 0, 0.004]}
          renderOrder={12}
        >
          <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
          <meshBasicMaterial
            color={healthColor}
            transparent
            opacity={0.98}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        {Array.from(
          { length: HEALTH_BAR_SEGMENT_COUNT - 1 },
          (_, index) => (
            <mesh
              key={index}
              position={[
                -BAR_WIDTH / 2 +
                  (BAR_WIDTH * (index + 1)) / HEALTH_BAR_SEGMENT_COUNT,
                0,
                0.008,
              ]}
              renderOrder={13}
            >
              <planeGeometry args={[DIVIDER_WIDTH, BAR_HEIGHT]} />
              <meshBasicMaterial
                color={DIVIDER_COLOR}
                transparent
                opacity={0.92}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          ),
        )}
        {showEffects ? (
          <>
            <EffectMedallion
              ref={(handle) => {
                effectSlotsRef.current[0] = handle;
              }}
            />
            <EffectMedallion
              ref={(handle) => {
                effectSlotsRef.current[1] = handle;
              }}
            />
          </>
        ) : null}
      </group>
    );
  },
);
