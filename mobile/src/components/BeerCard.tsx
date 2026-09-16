import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/colors";
import { MatchBadge } from "./MatchBadge";
import { BeerArt } from "./BeerArt";

type Props = {
  name: string;
  style: string;
  breweryName: string;
  imageUrl?: string | null;
  matchPercent?: number | null;
  subtitle?: string;
  onPress: () => void;
};

export function BeerCard({ name, style, breweryName, imageUrl, matchPercent, subtitle, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <BeerArt name={name} imageUrl={imageUrl} size={56} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{breweryName} · {style}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {matchPercent != null && <MatchBadge percent={matchPercent} size="sm" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  info: { marginLeft: spacing.sm, flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  subtitle: { fontSize: 12, color: colors.textMuted },
});
