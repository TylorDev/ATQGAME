import { forwardRef, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import {
  OverheadStatus,
  type OverheadStatusHandle,
} from "@/components/OverheadStatus/OverheadStatus";
import type { TestDummyDefinition, TestDummySnapshot } from "@/game/types";

const NO_ACTIVE_EFFECTS = [] as const;

interface TestDummyProps {
  definition: TestDummyDefinition;
  snapshot: TestDummySnapshot;
  selected: boolean;
  onActivate: () => void;
}

export const TestDummy = forwardRef<Group, TestDummyProps>(function TestDummy(
  { definition, snapshot, selected, onActivate },
  ref,
) {
  const overheadStatusRef = useRef<OverheadStatusHandle>(null);

  useFrame(() => {
    overheadStatusRef.current?.update({
      currentHealth: snapshot.currentHealth,
      maximumHealth: snapshot.maximumHealth,
      effects: NO_ACTIVE_EFFECTS,
    });
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    if (event.nativeEvent.button !== 0 && event.nativeEvent.button !== 2) {
      return;
    }

    event.stopPropagation();
    onActivate();
  };

  const bodyColor = snapshot.isDefeated ? "#4a3a3b" : "#b78b58";

  return (
    <group
      ref={ref}
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
          color={bodyColor}
          emissive={snapshot.isDefeated ? "#1c1112" : "#3a2416"}
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

      <OverheadStatus
        ref={overheadStatusRef}
        position={[0, 2.7, 0]}
        healthColor="#f0834f"
      />
    </group>
  );
});
