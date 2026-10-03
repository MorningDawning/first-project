import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { colors } from "../theme/colors";
import { TasteProfile } from "../types";

const AXES: { key: keyof TasteProfile; label: string }[] = [
  { key: "sweetness", label: "Сладость" },
  { key: "bitterness", label: "Горечь" },
  { key: "sourness", label: "Кислотность" },
  { key: "body", label: "Плотность" },
  { key: "aroma", label: "Аромат" },
];

function pointFor(index: number, value: number, center: number, radius: number) {
  const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
  const r = (value / 100) * radius;
  return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
}

type Props = {
  profile: TasteProfile;
  secondaryProfile?: TasteProfile;
  size?: number;
};

export function TasteRadar({ profile, secondaryProfile, size = 240 }: Props) {
  const center = size / 2;
  const radius = size / 2 - 34;

  const ringLevels = [0.25, 0.5, 0.75, 1];
  const mainPoints = AXES.map((a, i) => pointFor(i, profile[a.key], center, radius));
  const secondaryPoints = secondaryProfile
    ? AXES.map((a, i) => pointFor(i, secondaryProfile[a.key], center, radius))
    : null;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {ringLevels.map((level) => (
          <Polygon
            key={level}
            points={AXES.map((_, i) => {
              const p = pointFor(i, level * 100, center, radius);
              return `${p.x},${p.y}`;
            }).join(" ")}
            fill="none"
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}

        {AXES.map((_, i) => {
          const p = pointFor(i, 100, center, radius);
          return <Line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke={colors.border} strokeWidth={1} />;
        })}

        {secondaryPoints && (
          <Polygon
            points={secondaryPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={colors.accent}
            fillOpacity={0.18}
            stroke={colors.accent}
            strokeWidth={2}
          />
        )}

        <Polygon
          points={mainPoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill={colors.primary}
          fillOpacity={0.28}
          stroke={colors.primary}
          strokeWidth={2}
        />
        {mainPoints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.primary} />
        ))}

        {AXES.map((a, i) => {
          const labelPoint = pointFor(i, 122, center, radius);
          return (
            <SvgText
              key={a.key}
              x={labelPoint.x}
              y={labelPoint.y}
              fontSize={11}
              fill={colors.text}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {a.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
