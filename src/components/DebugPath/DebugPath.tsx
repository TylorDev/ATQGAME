import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  LineSegments,
  Mesh,
} from "three";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import { HOLD_DELAY_MS } from "@/game/constants";
import { isHeldGroundProjectionActive } from "@/game/pointerProjection";

interface DebugPathProps {
  visible: boolean;
}

function writePathIfChanged(
  positions: Float32Array,
  previous: Float32Array,
  geometry: BufferGeometry | null,
): void {
  let changed = false;

  for (let index = 0; index < positions.length; index += 1) {
    if (positions[index] !== previous[index]) {
      previous[index] = positions[index];
      changed = true;
    }
  }

  if (!changed || !geometry) {
    return;
  }

  const positionAttribute = geometry.getAttribute("position");

  if (positionAttribute instanceof BufferAttribute) {
    positionAttribute.needsUpdate = true;
  }
}

export function DebugPath({ visible }: DebugPathProps) {
  const { input, runtime } = useGameRuntimeServices();
  const pathLineRef = useRef<LineSegments>(null);
  const pathGeometryRef = useRef<BufferGeometry>(null);
  const selectedPathLineRef = useRef<LineSegments>(null);
  const selectedPathGeometryRef = useRef<BufferGeometry>(null);
  const destinationMarkerRef = useRef<Mesh>(null);
  const pathPositions = useMemo(() => new Float32Array(6), []);
  const selectedPathPositions = useMemo(() => new Float32Array(6), []);
  const previousPathPositions = useMemo(
    () => new Float32Array(6).fill(Number.NaN),
    [],
  );
  const previousSelectedPathPositions = useMemo(
    () => new Float32Array(6).fill(Number.NaN),
    [],
  );

  useFrame(() => {
    const frame = runtime.getRenderFrame();
    const timestampMs = performance.now();
    const showClickPath =
      visible &&
      frame.movement.mode === "clickToPoint" &&
      frame.movement.isClickTargetConfirmed &&
      frame.movement.target !== null;
    const showHeldDirection =
      visible &&
      isHeldGroundProjectionActive(
        input.pointerId,
        input.rightPressStartedAtMs,
        timestampMs,
        HOLD_DELAY_MS,
      );
    const showPath = showClickPath || showHeldDirection;
    const pathTarget = showHeldDirection
      ? input.groundPoint
      : frame.movement.target;

    if (pathLineRef.current) {
      pathLineRef.current.visible = showPath;
    }

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.visible = showClickPath;
    }

    if (showPath && pathTarget) {
      const position = frame.interpolatedPlayerPosition;
      pathPositions[0] = position.x;
      pathPositions[1] = 0.07;
      pathPositions[2] = position.z;
      pathPositions[3] = pathTarget.x;
      pathPositions[4] = 0.07;
      pathPositions[5] = pathTarget.z;
      writePathIfChanged(
        pathPositions,
        previousPathPositions,
        pathGeometryRef.current,
      );

      if (showClickPath) {
        destinationMarkerRef.current?.position.set(
          pathTarget.x,
          0.075,
          pathTarget.z,
        );
      }
    }

    if (selectedPathLineRef.current) {
      selectedPathLineRef.current.visible = frame.targetSelected;
    }

    if (frame.targetSelected) {
      const position = frame.interpolatedPlayerPosition;
      selectedPathPositions[0] = position.x;
      selectedPathPositions[1] = 0.09;
      selectedPathPositions[2] = position.z;
      selectedPathPositions[3] = frame.targetPosition.x;
      selectedPathPositions[4] = 0.09;
      selectedPathPositions[5] = frame.targetPosition.z;
      writePathIfChanged(
        selectedPathPositions,
        previousSelectedPathPositions,
        selectedPathGeometryRef.current,
      );
    }
  }, GAME_FRAME_PRIORITY.debug);

  return (
    <>
      <lineSegments ref={pathLineRef} visible={false} frustumCulled={false}>
        <bufferGeometry ref={pathGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[pathPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#63c2b4"
          transparent
          opacity={0.9}
          depthTest={false}
        />
      </lineSegments>

      <lineSegments
        ref={selectedPathLineRef}
        visible={false}
        frustumCulled={false}
      >
        <bufferGeometry ref={selectedPathGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[selectedPathPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#e47b71"
          transparent
          opacity={0.96}
          depthTest={false}
        />
      </lineSegments>

      <mesh
        ref={destinationMarkerRef}
        visible={false}
        rotation-x={-Math.PI / 2}
      >
        <ringGeometry args={[0.28, 0.42, 32]} />
        <meshBasicMaterial
          color="#63c2b4"
          transparent
          opacity={0.92}
          depthTest={false}
        />
      </mesh>
    </>
  );
}
