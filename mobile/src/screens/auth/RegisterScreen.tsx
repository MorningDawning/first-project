import React, { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { AgeConsent } from "../../components/AgeConsent";
import { checkAgeConsent } from "../../lib/birthDate";
import { useAuth } from "../../context/AuthContext";
import { apiErrorMessage } from "../../api/client";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { colors, spacing, typography } from "../../theme/colors";
import { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const kb = useKeyboardAvoidance();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    const checked = checkAgeConsent(birthDate, accepted);
    if ("error" in checked) return setError(checked.error);
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim(), checked.iso);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось зарегистрироваться"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Создать аккаунт</Text>

        <View style={styles.form}>
          <TextField label="Имя" value={name} onChangeText={setName} placeholder="Как вас называть?" />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <TextField
            label="Пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="минимум 6 символов"
          />
          <AgeConsent birthDate={birthDate} onBirthDateChange={setBirthDate} accepted={accepted} onAcceptedChange={setAccepted} />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Зарегистрироваться" onPress={handleRegister} loading={loading} style={{ marginTop: spacing.sm }} />
          <Button title="Уже есть аккаунт" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  title: { ...typography.title, textAlign: "center", marginBottom: spacing.xl },
  form: { marginTop: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm, textAlign: "center" },
});
