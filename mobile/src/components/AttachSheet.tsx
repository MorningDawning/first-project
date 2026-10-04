import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, IconName } from "./icons/Icon";
import { colors, fonts, radius, spacing } from "../theme/colors";

type Option = { key: string; label: string; icon: IconName; onPress: () => void };

/** Нижнее меню «Прикрепить»: пиво, фото из галереи, снимок с камеры. */
export function AttachSheet({ visible, options, onClose }: { visible: boolean; options: Option[]; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => {
              onClose();
              // даём меню закрыться, прежде чем открывать системный выбор
              setTimeout(o.onPress, 250);
            }}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.iconBox}>
              <Icon name={o.icon} color={colors.text} size={20} />
            </View>
            <Text style={styles.label}>{o.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>Отмена</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(44,24,16,0.4)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: { width: 44, height: 5, borderRadius: 9, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.card, borderRadius: 22, padding: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  cancel: { height: 50, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textMuted },
});
