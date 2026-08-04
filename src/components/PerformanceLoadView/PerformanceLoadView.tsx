import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DynamicDrawUsage, InstancedMesh, Object3D } from "three";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import {
  type OverheadStatusRegistration,
  type OverheadStatusUpdate,
} from "@/components/OverheadStatus/OverheadStatusSystem";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";

const NO_EFFECTS = [] as const;

interface PerformanceLoadViewProps {
  visibleCount: number;
}

export function PerformanceLoadView({
  visibleCount,
}: PerformanceLoadViewProps) {
  const { overheadRegistry, runtime } = useGameRuntimeServices();
  const meshRef = useRef<InstancedMesh>(null);
  const objectRef = useRef(new Object3D());
  const registrationsRef = useRef<OverheadStatusRegistration[]>([]);
  const overheadUpdateRef = useRef<OverheadStatusUpdate>({
    x: 0,
    y: 1.72,
    z: 0,
    currentHealth: 100,
    maximumHealth: 100,
    healthColor: "#f0834f",
    effects: NO_EFFECTS,
  });

  useEffect(() => {
    const registrations = registrationsRef.current;

    for (let index = 0; index < visibleCount; index += 1) {
      registrations.push(
        overheadRegistry.register(`performance-entity-${index}`),
      );
    }

    if (meshRef.current) {
      meshRef.current.instanceMatrix.setUsage(DynamicDrawUsage);
    }

    return () => {
      for (let index = 0; index < registrations.length; index += 1) {
        overheadRegistry.unregister(registrations[index]);
      }
      registrations.length = 0;
    };
  }, [overheadRegistry, visibleCount]);

  useFrame(() => {
    const mesh = meshRef.current;
    const frame = runtime.getRenderFrame();
    const load = frame.performanceLoad;

    if (!mesh || !load) {
      return;
    }

    for (let index = 0; index < load.visibleCount; index += 1) {
      const positionIndex = index * 2;
      const x =
        load.previousPositions[positionIndex] +
        (load.currentPositions[positionIndex] -
          load.previousPositions[positionIndex]) *
          frame.interpolationAlpha;
      const z =
        load.previousPositions[positionIndex + 1] +
        (load.currentPositions[positionIndex + 1] -
          load.previousPositions[positionIndex + 1]) *
          frame.interpolationAlpha;
      const object = objectRef.current;
      object.position.set(x, 0.72, z);
      object.rotation.y = index * 0.37;
      object.scale.set(0.52, 1.2, 0.52);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
      const registration = registrationsRef.current[index];

      if (registration) {
        const update = overheadUpdateRef.current;
        update.x = x;
        update.z = z;
        update.currentHealth = 75 + (index % 4) * 5;
        overheadRegistry.update(registration, update);
      }
    }

    mesh.count = load.visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
  }, GAME_FRAME_PRIORITY.presentation);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, visibleCount]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <capsuleGeometry args={[0.45, 0.9, 4, 8]} />
      <meshStandardMaterial color="#61788b" roughness={0.74} />
    </instancedMesh>
  );
}
