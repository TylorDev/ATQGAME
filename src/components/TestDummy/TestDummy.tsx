import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type RefObject,
} from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { Group, MeshStandardMaterial } from "three";
import {
  type OverheadStatusRegistration,
  OverheadStatusRegistry,
} from "@/components/OverheadStatus/OverheadStatusSystem";
import type {
  TestDummyDefinition,
  TestDummySnapshot,
} from "@/game/types";

const NO_ACTIVE_EFFECTS = [] as const;

export interface TestDummyHandle {
  readonly objectRef: RefObject<Group | null>;
  update(state: TestDummySnapshot): void;
}

interface TestDummyProps {
  definition: TestDummyDefinition;
  selected: boolean;
  onActivate: () => void;
  registry: OverheadStatusRegistry;
}

export const TestDummy = forwardRef<TestDummyHandle, TestDummyProps>(
  function TestDummy(
    { definition, selected, onActivate, registry },
    ref,
  ) {
    const groupRef = useRef<Group>(null);
    const bodyMaterialRef = useRef<MeshStandardMaterial>(null);
    const registrationRef =
      useRef<OverheadStatusRegistration | null>(null);

    useEffect(() => {
      const registration = registry.register(definition.id);
      registrationRef.current = registration;
      registry.update(registration, {
        x: definition.xMeters,
        y: 2.7,
        z: definition.zMeters,
        currentHealth: definition.maximumHealth,
        maximumHealth: definition.maximumHealth,
        healthColor: "#f0834f",
        effects: NO_ACTIVE_EFFECTS,
      });

      return () => {
        registry.unregister(registration);
        registrationRef.current = null;
      };
    }, [definition, registry]);

    useImperativeHandle(
      ref,
      () => ({
        objectRef: groupRef,
        update(state) {
          const material = bodyMaterialRef.current;

          if (material) {
            material.color.set(state.isDefeated ? "#4a3a3b" : "#b78b58");
            material.emissive.set(
              state.isDefeated ? "#1c1112" : "#3a2416",
            );
          }

          const registration = registrationRef.current;

          if (registration) {
            registry.update(registration, {
              x: definition.xMeters,
              y: 2.7,
              z: definition.zMeters,
              currentHealth: state.currentHealth,
              maximumHealth: state.maximumHealth,
              healthColor: "#f0834f",
              effects: NO_ACTIVE_EFFECTS,
            });
          }
        },
      }),
      [definition, registry],
    );

    const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
      if (event.nativeEvent.button !== 0 && event.nativeEvent.button !== 2) {
        return;
      }

      event.stopPropagation();
      onActivate();
    };

    return (
      <group
        ref={groupRef}
        position={[definition.xMeters, 0, definition.zMeters]}
        onPointerDown={handlePointerDown}
      >
        <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.62, 0.72, 0.36, 18]} />
          <meshStandardMaterial color="#4e4039" roughness={0.78} />
        </mesh>
        <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.47, 1.35, 14]} />
          <meshStandardMaterial
            ref={bodyMaterialRef}
            color="#b78b58"
            emissive="#3a2416"
            emissiveIntensity={0.28}
            roughness={0.68}
          />
        </mesh>
        <mesh position={[0, 1.92, 0]} castShadow>
          <sphereGeometry args={[0.4, 18, 12]} />
          <meshStandardMaterial color="#d8c0a0" roughness={0.62} />
        </mesh>
        <mesh position={[0, 1.92, 0.36]} castShadow>
          <boxGeometry args={[0.42, 0.08, 0.07]} />
          <meshStandardMaterial color="#332721" roughness={0.54} />
        </mesh>

        <mesh
          visible={selected}
          position={[0, 0.035, 0]}
          rotation-x={-Math.PI / 2}
        >
          <ringGeometry args={[0.82, 0.96, 40]} />
          <meshBasicMaterial
            color="#e47b71"
            transparent
            opacity={0.95}
            depthTest={false}
          />
        </mesh>
      </group>
    );
  },
);
