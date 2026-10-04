import React from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "./icons/Icon";

const TONES = [
  { bg: "#CCDBB2", fg: "#3D472B" },
  { bg: "#FBDFD3", fg: "#8C491A" },
  { bg: "#EEE7DB", fg: "#474238" },
  { bg: "#E1EECC", fg: "#3D472B" },
  { bg: "#E8DCC8", fg: "#8C491A" },
];

export function GroupAvatar({ id, size = 52 }: { id: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const tone = TONES[hash % TONES.length];
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg }]}>
      <Icon name="users" color={tone.fg} size={size * 0.46} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
