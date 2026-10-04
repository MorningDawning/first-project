import React from "react";
import Svg, { Path } from "react-native-svg";

/** Иконка по готовому контуру SVG (24×24) — для значков, которых нет в наборе Icon. */
export function PathIcon({ d, size = 20, color, strokeWidth = 2.6 }: { d: string; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const ICON_PATHS = {
  back: "M19 12H5M12 19l-7-7 7-7",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  plus: "M12 5v14M5 12h14",
  check: "M20 6 9 17l-5-5",
  warn: "M12 8v5M12 17h.01",
  star: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z",
  temp: "M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z",
  glass: "M8 22h8M12 15v7M6 3h12l-1 7a5 5 0 0 1-10 0z",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
};
