import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "../theme/colors";
import { BeerArt } from "./BeerArt";
import { MatchBadge } from "./MatchBadge";

type Props = {
  name: string;
  style: string;
  imageUrl?: string | null;
  matchPercent?: number | null;
  onPress: () => void;
};

export function ForYouCard({ name, style, imageUrl, matchPercent, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.art}>
        <BeerArt name={name} imageUrl={imageUrl} size={80} shape="rounded" />
        {matchPercent != null && (
          <View style={styles.badgeWrap}>
            <MatchBadge percent={matchPercent} size="sm" />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.style} numberOfLines={1}>{style}</Text>
    </Pressable>
  );
}

const CARD_WIDTH = 156;

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, backgroundColor: colors.card, borderRadius: radius.lg, padding: 10, gap: spacing.sm },
  pressed: { opacity: 0.85 },
  art: {
    height: 128,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWrap: { position: "absolute", left: 8, top: 8 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, paddingHorizontal: 2 },
  style: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, paddingHorizontal: 2 },
});
