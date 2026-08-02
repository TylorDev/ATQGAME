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
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ARENA_SIZE_METERS, ARENA_SIZE_METERS]} />
        <meshStandardMaterial color="#263342" roughness={0.94} />
      </mesh>

      <gridHelper
        args={[ARENA_SIZE_METERS, ARENA_GRID_DIVISIONS, "#657c88", "#344655"]}
        position={[0, 0.012, 0]}
      />

      <group position={[BURNING_TILE.xMeters, 0, BURNING_TILE.zMeters]}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, 0]} receiveShadow>
          <planeGeometry
            args={[
              BURNING_TILE.widthMeters + burningTileBorderThicknessMeters * 2,
              BURNING_TILE.depthMeters + burningTileBorderThicknessMeters * 2,
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
        <mesh position={[0, 0.045, -BURNING_TILE.depthMeters / 2]}>
          <boxGeometry
            args={[
              BURNING_TILE.widthMeters,
              0.04,
              burningTileBorderThicknessMeters,
            ]}
          />
          <meshStandardMaterial
            color="#e16a3c"
            emissive="#80220f"
            emissiveIntensity={1.1}
          />
        </mesh>
        <mesh position={[0, 0.045, BURNING_TILE.depthMeters / 2]}>
          <boxGeometry
            args={[
              BURNING_TILE.widthMeters,
              0.04,
              burningTileBorderThicknessMeters,
            ]}
          />
          <meshStandardMaterial
            color="#e16a3c"
            emissive="#80220f"
            emissiveIntensity={1.1}
          />
        </mesh>
        <mesh position={[-BURNING_TILE.widthMeters / 2, 0.045, 0]}>
          <boxGeometry
            args={[
              burningTileBorderThicknessMeters,
              0.04,
              BURNING_TILE.depthMeters,
            ]}
          />
          <meshStandardMaterial
            color="#e16a3c"
            emissive="#80220f"
            emissiveIntensity={1.1}
          />
        </mesh>
        <mesh position={[BURNING_TILE.widthMeters / 2, 0.045, 0]}>
          <boxGeometry
            args={[
              burningTileBorderThicknessMeters,
              0.04,
              BURNING_TILE.depthMeters,
            ]}
          />
          <meshStandardMaterial
            color="#e16a3c"
            emissive="#80220f"
            emissiveIntensity={1.1}
          />
        </mesh>
      </group>

      {OBSTACLES.map((obstacle) => (
        <mesh
          key={obstacle.id}
          position={[
            obstacle.xMeters,
            obstacle.heightMeters / 2,
            obstacle.zMeters,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[
              obstacle.widthMeters,
              obstacle.heightMeters,
              obstacle.depthMeters,
            ]}
          />
          <meshStandardMaterial
            color="#755f52"
            emissive="#2c211c"
            emissiveIntensity={0.18}
            roughness={0.72}
            metalness={0.08}
          />
        </mesh>
      ))}

      <mesh
        position={[0, boundaryHeightMeters / 2, -ARENA_SIZE_METERS / 2]}
        receiveShadow
      >
        <boxGeometry
          args={[
            ARENA_SIZE_METERS,
            boundaryHeightMeters,
            boundaryThicknessMeters,
          ]}
        />
        <meshStandardMaterial color="#8a735e" roughness={0.76} />
      </mesh>
      <mesh
        position={[0, boundaryHeightMeters / 2, ARENA_SIZE_METERS / 2]}
        receiveShadow
      >
        <boxGeometry
          args={[
            ARENA_SIZE_METERS,
            boundaryHeightMeters,
            boundaryThicknessMeters,
          ]}
        />
        <meshStandardMaterial color="#8a735e" roughness={0.76} />
      </mesh>
      <mesh
        position={[-ARENA_SIZE_METERS / 2, boundaryHeightMeters / 2, 0]}
        receiveShadow
      >
        <boxGeometry
          args={[
            boundaryThicknessMeters,
            boundaryHeightMeters,
            ARENA_SIZE_METERS,
          ]}
        />
        <meshStandardMaterial color="#8a735e" roughness={0.76} />
      </mesh>
      <mesh
        position={[ARENA_SIZE_METERS / 2, boundaryHeightMeters / 2, 0]}
        receiveShadow
      >
        <boxGeometry
          args={[
            boundaryThicknessMeters,
            boundaryHeightMeters,
            ARENA_SIZE_METERS,
          ]}
        />
        <meshStandardMaterial color="#8a735e" roughness={0.76} />
      </mesh>
    </group>
  );
}
