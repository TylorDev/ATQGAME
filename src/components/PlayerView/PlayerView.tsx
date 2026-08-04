import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh } from "three";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import {
  type OverheadStatusRegistration,
  type OverheadStatusUpdate,
} from "@/components/OverheadStatus/OverheadStatusSystem";
import { PlayerArea } from "@/components/PlayerArea/PlayerArea";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import { resolvePointerFacingYaw } from "@/game/playerOrientation";

const PLAYER_OVERHEAD_Y = 2.38;

export function PlayerView() {
  const { input, overheadRegistry, runtime } = useGameRuntimeServices();
  const groupRef = useRef<Group>(null);
  const playerAreaRef = useRef<Mesh>(null);
  const registrationRef = useRef<OverheadStatusRegistration | null>(null);
  const overheadUpdateRef = useRef<OverheadStatusUpdate>({
    x: 0,
    y: PLAYER_OVERHEAD_Y,
    z: 0,
    currentHealth: 0,
    maximumHealth: 1,
    healthColor: "#74d641",
    effects: [],
  });

  useEffect(() => {
    const registration = overheadRegistry.register("local-player");
    registrationRef.current = registration;

    return () => {
      overheadRegistry.unregister(registration);
      registrationRef.current = null;
    };
  }, [overheadRegistry]);

  useFrame(() => {
    const frame = runtime.getRenderFrame();
    const position = frame.interpolatedPlayerPosition;

    if (playerAreaRef.current) {
      playerAreaRef.current.visible = frame.playerAreaActive;
    }

    const group = groupRef.current;

    if (group) {
      group.position.set(position.x, 0.9, position.z);
      group.rotation.y = resolvePointerFacingYaw(
        group.rotation.y,
        input.hasGroundHit,
        position,
        input.groundPoint,
      );
    }

    const registration = registrationRef.current;

    if (registration) {
      const update = overheadUpdateRef.current;
      update.x = position.x;
      update.z = position.z;
      update.currentHealth = frame.playerCombat.currentHealth;
      update.maximumHealth = frame.playerCombat.maximumHealth;
      update.effects = frame.playerEffects;
      overheadRegistry.update(registration, update);
    }
  }, GAME_FRAME_PRIORITY.presentation);

  return (
    <group ref={groupRef} position={[0, 0.9, 0]}>
      <PlayerArea ref={playerAreaRef} />

      <mesh castShadow>
        <capsuleGeometry args={[0.45, 0.9, 8, 16]} />
        <meshStandardMaterial
          color="#d9d4c7"
          roughness={0.52}
          metalness={0.08}
        />
      </mesh>

      <mesh position={[0, 0.12, 0.7]} rotation-x={Math.PI / 2} castShadow>
        <coneGeometry args={[0.17, 0.48, 3]} />
        <meshStandardMaterial
          color="#63c2b4"
          emissive="#285b54"
          emissiveIntensity={0.8}
        />
      </mesh>

      <mesh position={[0, -0.88, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.67, 32]} />
        <meshBasicMaterial color="#d7a96b" transparent opacity={0.82} />
      </mesh>
    </group>
  );
}
