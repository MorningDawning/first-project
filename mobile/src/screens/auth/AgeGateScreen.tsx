import React, { useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { AgeConsent } from "../../components/AgeConsent";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { checkAgeConsent } from "../../lib/birthDate";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { colors, spacing, typography } from "../../theme/colors";

/** Для аккаунтов, созданных до появления ограничения 18+: пока возраст не подтверждён, приложение закрыто. */
export function AgeGateScreen() {
  const kb = useKeyboardAvoidance();
  const { logout, refreshUser } = useAuth();
  const [birthDate, setBirthDate] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    const checked = checkAgeConsent(birthDate, accepted);
    if ("error" in checked) return setError(checked.error);
    setLoading(true);
    try {
      await userApi.confirmAge(checked.iso);
      await refreshUser();
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось подтвердить возраст"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.emoji}>🔞</Text>
          <Text style={styles.title}>Только для совершеннолетних</Text>
          <Text style={styles.lead}>
            BeerVia — приложение о пиве, им можно пользоваться с 18 лет. Подтвердите свой возраст, чтобы продолжить.
          </Text>
          <View style={styles.form}>
            <AgeConsent birthDate={birthDate} onBirthDateChange={setBirthDate} accepted={accepted} onAcceptedChange={setAccepted} />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button title="Подтвердить" onPress={submit} loading={loading} />
            <Button title="Выйти из аккаунта" variant="outline" onPress={logout} style={{ marginTop: spacing.sm }} />
          </View>
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  emoji: { fontSize: 44, textAlign: "center" },
  title: { ...typography.title, textAlign: "center", marginTop: spacing.sm },
  lead: { ...typography.body, textAlign: "center", color: colors.textMuted, marginTop: spacing.sm },
  form: { marginTop: spacing.xl },
  error: { color: colors.danger, marginBottom: spacing.sm, textAlign: "center" },
});
