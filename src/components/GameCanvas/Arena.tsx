import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import {
  ARENA_GRID_DIVISIONS,
  ARENA_SIZE_METERS,
  BURNING_TILE,
  OBSTACLES,
} from "@/game/constants";

const boundaryThicknessMeters = 0.18;
const boundaryHeightMeters = 0.42;
const burningTileBorderThicknessMeters = 0.1;

export function Arena() {
  const obstacleMeshRef = useRef<InstancedMesh>(null);
  const boundaryMeshRef = useRef<InstancedMesh>(null);
  const burningBorderMeshRef = useRef<InstancedMesh>(null);
  const transform = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const obstacleMesh = obstacleMeshRef.current;
    const boundaryMesh = boundaryMeshRef.current;
    const burningBorderMesh = burningBorderMeshRef.current;

    if (obstacleMesh) {
      for (let index = 0; index < OBSTACLES.length; index += 1) {
        const obstacle = OBSTACLES[index];
        transform.position.set(
          obstacle.xMeters,
          obstacle.heightMeters / 2,
          obstacle.zMeters,
        );
        transform.scale.set(
          obstacle.widthMeters,
          obstacle.heightMeters,
          obstacle.depthMeters,
        );
        transform.rotation.set(0, 0, 0);
        transform.updateMatrix();
        obstacleMesh.setMatrixAt(index, transform.matrix);
      }

      obstacleMesh.instanceMatrix.needsUpdate = true;
    }

    if (boundaryMesh) {
      const boundaries = [
        [
          0,
          boundaryHeightMeters / 2,
          -ARENA_SIZE_METERS / 2,
          ARENA_SIZE_METERS,
          boundaryHeightMeters,
          boundaryThicknessMeters,
        ],
        [
          0,
          boundaryHeightMeters / 2,
          ARENA_SIZE_METERS / 2,
          ARENA_SIZE_METERS,
          boundaryHeightMeters,
          boundaryThicknessMeters,
        ],
        [
          -ARENA_SIZE_METERS / 2,
          boundaryHeightMeters / 2,
          0,
          boundaryThicknessMeters,
          boundaryHeightMeters,
          ARENA_SIZE_METERS,
        ],
        [
          ARENA_SIZE_METERS / 2,
          boundaryHeightMeters / 2,
          0,
          boundaryThicknessMeters,
          boundaryHeightMeters,
          ARENA_SIZE_METERS,
        ],
      ] as const;

      for (let index = 0; index < boundaries.length; index += 1) {
        const [x, y, z, width, height, depth] = boundaries[index];
        transform.position.set(x, y, z);
        transform.scale.set(width, height, depth);
        transform.rotation.set(0, 0, 0);
        transform.updateMatrix();
        boundaryMesh.setMatrixAt(index, transform.matrix);
      }

      boundaryMesh.instanceMatrix.needsUpdate = true;
    }

    if (burningBorderMesh) {
      const borders = [
        [
          0,
          0.045,
          -BURNING_TILE.depthMeters / 2,
          BURNING_TILE.widthMeters,
          0.04,
          burningTileBorderThicknessMeters,
        ],
        [
          0,
          0.045,
          BURNING_TILE.depthMeters / 2,
          BURNING_TILE.widthMeters,
          0.04,
          burningTileBorderThicknessMeters,
        ],
        [
          -BURNING_TILE.widthMeters / 2,
          0.045,
          0,
          burningTileBorderThicknessMeters,
          0.04,
          BURNING_TILE.depthMeters,
        ],
        [
          BURNING_TILE.widthMeters / 2,
          0.045,
          0,
          burningTileBorderThicknessMeters,
          0.04,
          BURNING_TILE.depthMeters,
        ],
      ] as const;

      for (let index = 0; index < borders.length; index += 1) {
        const [x, y, z, width, height, depth] = borders[index];
        transform.position.set(x, y, z);
        transform.scale.set(width, height, depth);
        transform.rotation.set(0, 0, 0);
        transform.updateMatrix();
        burningBorderMesh.setMatrixAt(index, transform.matrix);
      }

      burningBorderMesh.instanceMatrix.needsUpdate = true;
    }
  }, [transform]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ARENA_SIZE_METERS, ARENA_SIZE_METERS]} />
        <meshStandardMaterial color="#263342" roughness={0.94} />
      </mesh>

      <gridHelper
        args={[
          ARENA_SIZE_METERS,
          ARENA_GRID_DIVISIONS,
          "#657c88",
          "#344655",
        ]}
        position={[0, 0.012, 0]}
      />

      <group position={[BURNING_TILE.xMeters, 0, BURNING_TILE.zMeters]}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, 0]} receiveShadow>
          <planeGeometry
            args={[
              BURNING_TILE.widthMeters +
                burningTileBorderThicknessMeters * 2,
              BURNING_TILE.depthMeters +
                burningTileBorderThicknessMeters * 2,
            ]}
          />
          <meshStandardMaterial
            color="#321418"
            emissive="#1c0608"
            emissiveIntensity={0.72}
            roughness={0.82}
          />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.024, 0]} receiveShadow>
          <planeGeometry
            args={[BURNING_TILE.widthMeters, BURNING_TILE.depthMeters]}
          />
          <meshStandardMaterial
            color="#852b25"
            emissive="#48100f"
            emissiveIntensity={0.9}
            roughness={0.68}
          />
        </mesh>
        <instancedMesh
          ref={burningBorderMeshRef}
          args={[undefined, undefined, 4]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#e16a3c"
            emissive="#80220f"
            emissiveIntensity={1.1}
          />
        </instancedMesh>
      </group>

      <instancedMesh
        ref={obstacleMeshRef}
        args={[undefined, undefined, OBSTACLES.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#755f52"
          emissive="#2c211c"
          emissiveIntensity={0.18}
          roughness={0.72}
          metalness={0.08}
        />
      </instancedMesh>

      <instancedMesh
        ref={boundaryMeshRef}
        args={[undefined, undefined, 4]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8a735e" roughness={0.76} />
      </instancedMesh>
    </group>
  );
}
