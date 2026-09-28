import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type IconProps = { color: string; size?: number };

export function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12 L12 4 L21 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="5.5" y="12" width="13" height="8" rx="1" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export function LibraryIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 3 H14 V6 C14 6 17 7.5 17 10.5 V19 A2 2 0 0 1 15 21 H9 A2 2 0 0 1 7 19 V10.5 C7 7.5 10 6 10 6 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BarIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="6" width="10" height="14" rx="2" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M15 9 C19.5 9 19.5 15.5 15 15.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={2} />
      <Path d="M4 20 C4 15 8 13 12 13 C16 13 20 15 20 20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CameraIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="4" width="6" height="3" rx="1" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Rect x="3" y="7" width="18" height="13" rx="2" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx="12" cy="13.5" r="4" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
