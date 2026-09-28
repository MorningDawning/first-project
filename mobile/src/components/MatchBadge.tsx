import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, matchTint, radius, spacing } from "../theme/colors";

export function MatchBadge({ percent, size = "md" }: { percent: number; size?: "sm" | "md" }) {
  const { bg, fg } = matchTint(percent);
  const small = size === "sm";
  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.badgeSmall]}>
      <Text style={[styles.text, { color: fg }, small && styles.textSmall]}>{percent}%</Text>
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
  text: { fontFamily: fonts.bodyBold, fontSize: 13 },
  textSmall: { fontSize: 12 },
});
