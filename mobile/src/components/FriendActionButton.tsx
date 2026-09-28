import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from "react-native";
import { Icon } from "./icons/Icon";
import { friendsApi } from "../api/beervia";
import { apiErrorMessage } from "../api/client";
import { colors, fonts, radius } from "../theme/colors";
import { FriendStatus } from "../types";

type Props = {
  userId: string;
  status: FriendStatus;
  onChanged: (status: FriendStatus) => void;
  variant?: "large" | "small" | "icon";
};

export function FriendActionButton({ userId, status, onChanged, variant = "large" }: Props) {
  const [busy, setBusy] = useState(false);
  if (status === "self") return null;

  async function run(action: () => Promise<FriendStatus>) {
    setBusy(true);
    try {
      onChanged(await action());
    } catch (e) {
      Alert.alert("Не получилось", apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sendRequest = () => run(async () => (await friendsApi.sendRequest(userId)).status);
  const remove = () =>
    run(async () => {
      await friendsApi.remove(userId);
      return "none";
    });

  function handlePress() {
    if (busy) return;
    if (status === "none" || status === "incoming") return void sendRequest();
    if (status === "outgoing") {
      Alert.alert("Отозвать заявку?", undefined, [
        { text: "Нет", style: "cancel" },
        { text: "Отозвать", style: "destructive", onPress: remove },
      ]);
      return;
    }
    Alert.alert("Убрать из друзей?", undefined, [
      { text: "Отмена", style: "cancel" },
      { text: "Убрать", style: "destructive", onPress: remove },
    ]);
  }

  const label =
    status === "none" ? "В друзья" : status === "incoming" ? "Принять" : status === "outgoing" ? "Заявка отправлена" : "Друзья";
  const filled = status === "none" || status === "incoming";
  const large = variant === "large";

  if (variant === "icon") {
    return (
      <Pressable onPress={handlePress} style={[styles.iconBtn, status === "outgoing" && styles.iconBtnMuted]} hitSlop={6}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <Icon name={filled ? "userPlus" : "check"} color={colors.text} size={18} strokeWidth={2.75} />
        )}
      </Pressable>
    );
  }

  const bg = filled ? (large ? colors.primary : colors.text) : status === "outgoing" ? "#EEE7DB" : "transparent";
  const fg = filled ? colors.background : status === "outgoing" ? "#474238" : colors.text;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        large ? styles.large : styles.small,
        { backgroundColor: bg },
        status === "friends" && styles.outlined,
        pressed && { opacity: 0.85 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {large && filled && <Icon name="userPlus" color={fg} size={18} strokeWidth={2.75} />}
          {status === "friends" && <Icon name="check" color={fg} size={large ? 16 : 13} strokeWidth={3} />}
          <Text
            style={[
              large ? (filled ? styles.largeFilledText : styles.largeText) : styles.smallText,
              { color: fg },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.pill },
  large: { height: 50, paddingHorizontal: 20 },
  small: { height: 34, paddingHorizontal: 14, alignSelf: "stretch" },
  outlined: { borderWidth: 2, borderColor: colors.text },
  largeFilledText: { fontFamily: fonts.display, fontSize: 16 },
  largeText: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  smallText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnMuted: { borderColor: colors.border },
});
