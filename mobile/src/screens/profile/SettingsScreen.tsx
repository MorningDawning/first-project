import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, spacing, typography } from "../../theme/colors";

export function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await userApi.updateMe({ name: name.trim(), bio: bio.trim() });
      await refreshUser();
      setSaved(true);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось сохранить изменения"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Настройки</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Профиль</Text>
          <TextField label="Имя" value={name} onChangeText={setName} />
          <TextField label="О себе" value={bio} onChangeText={setBio} multiline placeholder="Расскажите о своих вкусах" />
          {error && <Text style={styles.error}>{error}</Text>}
          {saved && <Text style={styles.saved}>Сохранено ✓</Text>}
          <Button title="Сохранить" onPress={handleSave} loading={saving} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Аккаунт</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Button title="Выйти из аккаунта" variant="outline" onPress={logout} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl },
  title: { ...typography.title },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.heading, marginBottom: spacing.xs },
  error: { color: colors.danger },
  saved: { color: colors.success, fontWeight: "700" },
  email: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm },
});
