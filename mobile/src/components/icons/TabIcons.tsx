import React from "react";
import Svg, { Path } from "react-native-svg";

export type IconProps = { color: string; size?: number };

function StrokeIcon({ d, color, size = 24 }: IconProps & { d: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return <StrokeIcon {...props} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
}

export function LibraryIcon(props: IconProps) {
  return <StrokeIcon {...props} d="M10 2h4v3l2 3v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8l2-3zM8 12h8" />;
}

export function BarIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      d="M5 8h11v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M9 12v5M12 12v5"
    />
  );
}

export function ProfileIcon(props: IconProps) {
  return <StrokeIcon {...props} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />;
}

export function CameraIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"
    />
  );
}
