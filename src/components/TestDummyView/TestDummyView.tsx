import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, MeshStandardMaterial } from "three";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import {
  type OverheadStatusRegistration,
  type OverheadStatusUpdate,
} from "@/components/OverheadStatus/OverheadStatusSystem";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import type { TestDummyDefinition } from "@/game/types";

const NO_ACTIVE_EFFECTS = [] as const;

interface TestDummyViewProps {
  definition: TestDummyDefinition;
}

export function TestDummyView({ definition }: TestDummyViewProps) {
  const { overheadRegistry, runtime, targetObjectRef } =
    useGameRuntimeServices();
  const bodyMaterialRef = useRef<MeshStandardMaterial>(null);
  const selectionRingRef = useRef<Mesh>(null);
  const registrationRef = useRef<OverheadStatusRegistration | null>(null);
  const overheadUpdateRef = useRef<OverheadStatusUpdate>({
    x: definition.xMeters,
    y: 2.7,
    z: definition.zMeters,
    currentHealth: definition.maximumHealth,
    maximumHealth: definition.maximumHealth,
    healthColor: "#f0834f",
    effects: NO_ACTIVE_EFFECTS,
  });
  const lastHealthRef = useRef(Number.NaN);
  const lastDefeatedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const registration = overheadRegistry.register(definition.id);
    registrationRef.current = registration;
    overheadRegistry.update(registration, overheadUpdateRef.current);

    return () => {
      overheadRegistry.unregister(registration);
      registrationRef.current = null;
    };
  }, [definition.id, overheadRegistry]);

  useFrame(() => {
    const frame = runtime.getRenderFrame();
    const state = frame.testDummy;

    if (selectionRingRef.current) {
      selectionRingRef.current.visible = frame.targetSelected;
    }

    if (
      state.currentHealth === lastHealthRef.current &&
      state.isDefeated === lastDefeatedRef.current
    ) {
      return;
    }

    const material = bodyMaterialRef.current;

    if (material) {
      material.color.set(state.isDefeated ? "#4a3a3b" : "#b78b58");
      material.emissive.set(state.isDefeated ? "#1c1112" : "#3a2416");
    }

    const registration = registrationRef.current;

    if (registration) {
      const update = overheadUpdateRef.current;
      update.currentHealth = state.currentHealth;
      update.maximumHealth = state.maximumHealth;
      overheadRegistry.update(registration, update);
    }

    lastHealthRef.current = state.currentHealth;
    lastDefeatedRef.current = state.isDefeated;
  }, GAME_FRAME_PRIORITY.presentation);

  return (
    <group
      ref={targetObjectRef}
      position={[definition.xMeters, 0, definition.zMeters]}
    >
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[0.62, definition.footprintRadiusMeters, 0.36, 18]}
        />
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
        ref={selectionRingRef}
        visible={false}
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
}
