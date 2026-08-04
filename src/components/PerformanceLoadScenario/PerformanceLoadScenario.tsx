import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { DynamicDrawUsage, InstancedMesh, Object3D } from "three";
import {
  type OverheadStatusRegistration,
  type OverheadStatusUpdate,
  OverheadStatusRegistry,
} from "@/components/OverheadStatus/OverheadStatusSystem";
import type { PerformanceLoadState } from "@/game/GameSimulation";

const NO_EFFECTS = [] as const;

export interface PerformanceLoadScenarioHandle {
  update(load: PerformanceLoadState, interpolationAlpha: number): void;
}

interface PerformanceLoadScenarioProps {
  registry: OverheadStatusRegistry;
  visibleCount: number;
}

export const PerformanceLoadScenario = forwardRef<
  PerformanceLoadScenarioHandle,
  PerformanceLoadScenarioProps
>(function PerformanceLoadScenario({ registry, visibleCount }, ref) {
  const meshRef = useRef<InstancedMesh>(null);
  const object = useRef(new Object3D());
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
      registrations.push(registry.register(`performance-entity-${index}`));
    }

    const mesh = meshRef.current;

    if (mesh) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    }

    return () => {
      for (let index = 0; index < registrations.length; index += 1) {
        registry.unregister(registrations[index]);
      }

      registrations.length = 0;
    };
  }, [registry, visibleCount]);

  useImperativeHandle(
    ref,
    () => ({
      update(load, interpolationAlpha) {
        const mesh = meshRef.current;

        if (!mesh) {
          return;
        }

        for (let index = 0; index < load.visibleCount; index += 1) {
          const positionIndex = index * 2;
          const x =
            load.previousPositions[positionIndex] +
            (load.currentPositions[positionIndex] -
              load.previousPositions[positionIndex]) *
              interpolationAlpha;
          const z =
            load.previousPositions[positionIndex + 1] +
            (load.currentPositions[positionIndex + 1] -
              load.previousPositions[positionIndex + 1]) *
              interpolationAlpha;
          object.current.position.set(x, 0.72, z);
          object.current.rotation.y = index * 0.37;
          object.current.scale.set(0.52, 1.2, 0.52);
          object.current.updateMatrix();
          mesh.setMatrixAt(index, object.current.matrix);
          const registration = registrationsRef.current[index];

          if (registration) {
            const overheadUpdate = overheadUpdateRef.current;
            overheadUpdate.x = x;
            overheadUpdate.z = z;
            overheadUpdate.currentHealth = 75 + (index % 4) * 5;
            registry.update(registration, overheadUpdate);
          }
        }

        mesh.count = load.visibleCount;
        mesh.instanceMatrix.needsUpdate = true;
      },
    }),
    [registry],
  );

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
});
