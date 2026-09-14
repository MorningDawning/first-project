import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { matchColor, radius, spacing } from "../theme/colors";

export function MatchBadge({ percent, size = "md" }: { percent: number; size?: "sm" | "md" }) {
  const color = matchColor(percent);
  const small = size === "sm";
  return (
    <View style={[styles.badge, { backgroundColor: color }, small && styles.badgeSmall]}>
      <Text style={[styles.text, small && styles.textSmall]}>{percent}% совпадение</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  badgeSmall: { paddingHorizontal: spacing.sm, paddingVertical: 3 },
  text: { color: "#fff", fontWeight: "700", fontSize: 13 },
  textSmall: { fontSize: 11 },
});
