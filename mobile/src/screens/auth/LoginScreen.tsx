import React, { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { apiErrorMessage } from "../../api/client";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { colors, fonts, spacing, typography } from "../../theme/colors";
import { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const kb = useKeyboardAvoidance();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось войти"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🍺 BeerVia</Text>
        <Text style={styles.subtitle}>Сканируй, оценивай, находи своё пиво</Text>

        <View style={styles.form}>
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
            placeholder="••••••••"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Войти" onPress={handleLogin} loading={loading} style={{ marginTop: spacing.sm }} />
          <Button
            title="Создать аккаунт"
            variant="outline"
            onPress={() => navigation.navigate("Register")}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  logo: { ...typography.title, fontFamily: fonts.brand, fontSize: 32, textAlign: "center", marginBottom: spacing.xs },
  subtitle: { ...typography.caption, textAlign: "center", marginBottom: spacing.xl },
  form: { marginTop: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm, textAlign: "center" },
  hint: { ...typography.caption, textAlign: "center", marginTop: spacing.md },
});
