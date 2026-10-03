import React, { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";

// x — доля ширины, size — диаметр, ms — время подъёма, delay — стартовая пауза, drift — боковое покачивание.
const BUBBLES = [
  { x: 0.06, size: 8, ms: 5200, delay: 0, drift: 5 },
  { x: 0.16, size: 5, ms: 4300, delay: 1700, drift: 4 },
  { x: 0.27, size: 10, ms: 6400, delay: 900, drift: 7 },
  { x: 0.38, size: 6, ms: 4800, delay: 2600, drift: 5 },
  { x: 0.47, size: 4, ms: 3900, delay: 400, drift: 3 },
  { x: 0.56, size: 9, ms: 6000, delay: 3200, drift: 6 },
  { x: 0.64, size: 5, ms: 4500, delay: 1200, drift: 4 },
  { x: 0.72, size: 7, ms: 5500, delay: 2200, drift: 6 },
  { x: 0.8, size: 4, ms: 4100, delay: 3600, drift: 3 },
  { x: 0.88, size: 8, ms: 5800, delay: 700, drift: 5 },
  { x: 0.94, size: 5, ms: 4700, delay: 2900, drift: 4 },
  { x: 0.33, size: 4, ms: 4200, delay: 4100, drift: 3 },
];

type Props = {
  color: string; // цвет пузырьков
  width: number; // ширина шапки
  height: number; // высота шапки
  foamHeight: number; // где кончается пена: выше пузырьки не поднимаются
};

/**
 * Пузырьки поднимаются со дна шапки к пене и лопаются, как в бокале. Анимация идёт только пока экран открыт
 * и выключается, если в телефоне включено «уменьшение движения».
 */
export function BeerBubbles({ color, width, height, foamHeight }: Props) {
  const focused = useIsFocused();
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useMemo(() => BUBBLES.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!focused || reduceMotion || height === 0) return;
    const loops = progress.map((value, i) => {
      value.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(BUBBLES[i].delay),
          Animated.timing(value, { toValue: 1, duration: BUBBLES[i].ms, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [focused, reduceMotion, height, progress]);

  if (height === 0 || width === 0) return null;
  const travel = Math.max(40, height - foamHeight - 36);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BUBBLES.map((b, i) => {
        const base = { position: "absolute" as const, left: b.x * width, width: b.size, height: b.size, borderRadius: b.size, backgroundColor: color };
        if (reduceMotion) {
          // Без движения пузырьки просто висят на разной высоте.
          return <View key={i} style={[base, { top: height - 30 - (((i * 37) % 100) / 100) * travel, opacity: 0.7 }]} />;
        }
        const rise = progress[i];
        return (
          <Animated.View
            key={i}
            style={[
              base,
              {
                top: height - 30,
                opacity: rise.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 0.9, 0.7, 0] }),
                transform: [
                  { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] }) },
                  { translateX: rise.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, b.drift, 0, -b.drift, 0] }) },
                  { scale: rise.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0.8, 1, 1.5] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}
