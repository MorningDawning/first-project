import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Icon } from "./icons/Icon";
import { colors } from "../theme/colors";

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}>
      <Icon name="back" color={colors.text} size={20} strokeWidth={2.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
});
