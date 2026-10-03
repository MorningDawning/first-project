import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme/colors";
import { resolveMediaUrl } from "../api/config";

const TONES = [
  { bg: "#CCDBB2", fg: "#272E1B" },
  { bg: "#FBDFD3", fg: "#643312" },
  { bg: "#EEE7DB", fg: "#474238" },
  { bg: "#E8DCC8", fg: "#474238" },
  { bg: "#E1EECC", fg: "#3D472B" },
];

function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

type Props = {
  user: { id: string; name: string; avatarUrl: string | null };
  size?: number;
  /** Свой аватар — фирменного цвета, как в макете. */
  me?: boolean;
};

export function Avatar({ user, size = 40, me = false }: Props) {
  const url = resolveMediaUrl(user.avatarUrl);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={[box, styles.image]} />;

  const tone = me ? { bg: colors.primary, fg: colors.background } : toneFor(user.id);
  return (
    <View style={[box, styles.center, { backgroundColor: tone.bg }]}>
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.42, color: tone.fg }}>
        {(user.name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  image: { backgroundColor: colors.border },
});
