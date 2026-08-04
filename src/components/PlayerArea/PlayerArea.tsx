import { forwardRef, useMemo } from "react";
import { Color, type Mesh } from "three";
import {
  PLAYER_AREA_BORDER_THICKNESS_METERS,
  PLAYER_AREA_RADIUS_METERS,
} from "@/game/playerArea";

const PLAYER_AREA_FILL_COLOR = "#1976ff";
const PLAYER_AREA_BORDER_COLOR = "#7ddcff";
const PLAYER_AREA_FILL_OPACITY = 0.28;
const PLAYER_AREA_GROUND_HEIGHT_METERS = 0.06;
const PLAYER_GROUP_HEIGHT_METERS = 0.9;
const PLAYER_AREA_GEOMETRY_MARGIN_METERS = 0.1;
const PLAYER_AREA_DIAMETER_METERS = PLAYER_AREA_RADIUS_METERS * 2;
const PLAYER_AREA_GEOMETRY_SIZE_METERS =
  PLAYER_AREA_DIAMETER_METERS + PLAYER_AREA_GEOMETRY_MARGIN_METERS * 2;

const vertexShader = /* glsl */ `
  varying vec2 vLocalPosition;

  void main() {
    vLocalPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 fillColor;
  uniform vec3 borderColor;
  uniform float fillOpacity;
  uniform float radiusMeters;
  uniform float borderThicknessMeters;

  varying vec2 vLocalPosition;

  void main() {
    float distanceMeters = length(vLocalPosition);
    float antialiasWidth = max(fwidth(distanceMeters), 0.0001);
    float circleCoverage = 1.0 - smoothstep(
      radiusMeters - antialiasWidth,
      radiusMeters + antialiasWidth,
      distanceMeters
    );
    float borderMix = smoothstep(
      radiusMeters - borderThicknessMeters - antialiasWidth,
      radiusMeters - borderThicknessMeters + antialiasWidth,
      distanceMeters
    );
    vec4 color = mix(
      vec4(fillColor, fillOpacity),
      vec4(borderColor, 1.0),
      borderMix
    );

    color.a *= circleCoverage;

    if (color.a <= 0.001) {
      discard;
    }

    gl_FragColor = color;
  }
`;

export const PlayerArea = forwardRef<Mesh>(function PlayerArea(_, ref) {
  const uniforms = useMemo(
    () => ({
      fillColor: { value: new Color(PLAYER_AREA_FILL_COLOR) },
      borderColor: { value: new Color(PLAYER_AREA_BORDER_COLOR) },
      fillOpacity: { value: PLAYER_AREA_FILL_OPACITY },
      radiusMeters: { value: PLAYER_AREA_RADIUS_METERS },
      borderThicknessMeters: {
        value: PLAYER_AREA_BORDER_THICKNESS_METERS,
      },
    }),
    [],
  );

  return (
    <mesh
      frustumCulled={false}
      position={[
        0,
        PLAYER_AREA_GROUND_HEIGHT_METERS - PLAYER_GROUP_HEIGHT_METERS,
        0,
      ]}
      ref={ref}
      rotation-x={-Math.PI / 2}
      visible={false}
    >
      <planeGeometry
        args={[
          PLAYER_AREA_GEOMETRY_SIZE_METERS,
          PLAYER_AREA_GEOMETRY_SIZE_METERS,
        ]}
      />
      <shaderMaterial
        depthTest
        depthWrite={false}
        fragmentShader={fragmentShader}
        transparent
        uniforms={uniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  );
});
