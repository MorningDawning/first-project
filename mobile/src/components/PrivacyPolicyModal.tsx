import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "./Screen";
import { Button } from "./Button";
import { legalApi } from "../api/beervia";
import { colors, spacing, typography } from "../theme/colors";

type Policy = { title: string; updatedAt: string; sections: { heading: string; body: string }[] };

type Props = { visible: boolean; onClose: () => void };

/** Политика конфиденциальности поверх любого экрана. Текст берётся с сервера, чтобы совпадать со страницей /privacy. */
export function PrivacyPolicyModal({ visible, onClose }: Props) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || policy) return;
    setFailed(false);
    legalApi.privacy().then(setPolicy).catch(() => setFailed(true));
  }, [visible, policy]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Политика конфиденциальности</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Закрыть</Text>
          </Pressable>
        </View>
        {policy ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.updated}>Редакция от {policy.updatedAt}</Text>
            {policy.sections.map((s) => (
              <View key={s.heading} style={styles.section}>
                <Text style={styles.heading}>{s.heading}</Text>
                <Text style={styles.body}>{s.body}</Text>
              </View>
            ))}
          </ScrollView>
        ) : failed ? (
          <View style={styles.center}>
            <Text style={styles.body}>Не удалось загрузить текст. Проверьте соединение и попробуйте снова.</Text>
            <Button title="Повторить" onPress={() => { setFailed(false); legalApi.privacy().then(setPolicy).catch(() => setFailed(true)); }} style={{ marginTop: spacing.md }} />
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.heading, flex: 1, marginRight: spacing.md },
  close: { color: colors.primary, fontWeight: "700", fontSize: 15 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  updated: { ...typography.caption },
  section: { gap: spacing.xs },
  heading: { ...typography.heading, fontSize: 16 },
  body: { ...typography.body, lineHeight: 21 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
});
