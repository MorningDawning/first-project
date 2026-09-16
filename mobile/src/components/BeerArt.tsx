import React, { useState } from "react";
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";

/**
 * Shows a beer's real photo when one is trustworthy and loads; otherwise a
 * generated placeholder (deterministic color + glass emoji from the beer's
 * name) instead of a blank box or — worse — a wrong photo. We don't have a
 * verified source of real per-beer product photography, so this is the
 * honest default rather than gambling on another unverified stock photo ID.
 */

const PALETTE: { bg: string; fg: string }[] = [
  { bg: "#F3D9CC", fg: colors.primary },
  { bg: "#F6E7C3", fg: "#B9791F" },
  { bg: "#DCE8DF", fg: colors.success },
  { bg: "#EFE1D0", fg: "#8A6F5C" },
  { bg: "#E3D6C8", fg: colors.textMuted },
  { bg: "#F0DCE0", fg: "#B0546B" },
];

function paletteFor(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

type Props = {
  name: string;
  imageUrl?: string | null;
  size: number;
  shape?: "circle" | "rounded" | "square";
  style?: StyleProp<ViewStyle>;
};

export function BeerArt({ name, imageUrl, size, shape = "rounded", style }: Props) {
  const [failed, setFailed] = useState(false);

  const borderRadius = shape === "circle" ? size / 2 : shape === "rounded" ? size * 0.22 : 0;
  const containerStyle: ViewStyle = { width: size, height: size, borderRadius, overflow: "hidden" };

  if (imageUrl && !failed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[containerStyle, style] as unknown as StyleProp<ImageStyle>}
        onError={() => setFailed(true)}
      />
    );
  }

  const { bg, fg } = paletteFor(name);
  return (
    <View style={[containerStyle, styles.placeholder, { backgroundColor: bg }, style]}>
      <Text style={{ fontSize: size * 0.42, color: fg }}>🍺</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: "center", justifyContent: "center" },
});
