import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TextField } from "./TextField";
import { PrivacyPolicyModal } from "./PrivacyPolicyModal";
import { maskBirthDate } from "../lib/birthDate";
import { colors, radius, spacing } from "../theme/colors";

type Props = {
  birthDate: string;
  onBirthDateChange: (masked: string) => void;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
};

/** Дата рождения и галочка «мне 18, согласен с политикой» — общая часть регистрации и подтверждения возраста. */
export function AgeConsent({ birthDate, onBirthDateChange, accepted, onAcceptedChange }: Props) {
  const [policyOpen, setPolicyOpen] = useState(false);
  return (
    <View>
      <TextField
        label="Дата рождения"
        value={birthDate}
        onChangeText={(text) => onBirthDateChange(maskBirthDate(text))}
        keyboardType="number-pad"
        placeholder="ДД.ММ.ГГГГ"
        maxLength={10}
      />
      <Pressable style={styles.row} onPress={() => onAcceptedChange(!accepted)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
        <View style={[styles.box, accepted && styles.boxChecked]}>{accepted && <Text style={styles.tick}>✓</Text>}</View>
        <Text style={styles.text}>
          Мне исполнилось 18 лет, я принимаю{" "}
          <Text style={styles.link} onPress={() => setPolicyOpen(true)}>
            политику конфиденциальности
          </Text>{" "}
          и согласен на обработку моих данных
        </Text>
      </Pressable>
      <PrivacyPolicyModal visible={policyOpen} onClose={() => setPolicyOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
  box: { width: 24, height: 24, borderRadius: radius.sm / 2, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: "#fff", fontWeight: "800", fontSize: 15 },
  text: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.text },
  link: { color: colors.primary, fontWeight: "700", textDecorationLine: "underline" },
});
