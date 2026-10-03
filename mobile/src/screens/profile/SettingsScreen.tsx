import React, { useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PrivacyPolicyModal } from "../../components/PrivacyPolicyModal";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { colors, spacing, typography } from "../../theme/colors";

export function SettingsScreen() {
  const kb = useKeyboardAvoidance();
  const { user, logout, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [deleting, setDeleting] = useState(false); // показан ли блок подтверждения удаления
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const handle = username.trim().replace(/^@/, "").toLowerCase();
      if (handle && !/^[a-z0-9_.]{3,20}$/.test(handle)) {
        setError("Имя пользователя: 3–20 символов, латиница, цифры, _ и точка");
        setSaving(false);
        return;
      }
      await userApi.updateMe({
        name: name.trim(),
        bio: bio.trim(),
        city: city.trim(),
        ...(handle && handle !== user?.username ? { username: handle } : {}),
      });
      await refreshUser();
      setSaved(true);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось сохранить изменения"));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    setDeleteError(null);
    if (!deletePassword) return setDeleteError("Введите пароль для подтверждения");
    Alert.alert(
      "Удалить аккаунт навсегда?",
      "Профиль, отзывы, посты, сообщения и загруженные файлы будут удалены без возможности восстановления.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            setDeleteBusy(true);
            try {
              await userApi.deleteAccount(deletePassword);
              await logout();
            } catch (e) {
              setDeleteError(apiErrorMessage(e, "Не удалось удалить аккаунт"));
              setDeleteBusy(false);
            }
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Настройки</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Профиль</Text>
          <TextField label="Имя" value={name} onChangeText={setName} />
          <TextField label="Имя пользователя" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="например, masha_hops" />
          <TextField label="Город" value={city} onChangeText={setCity} placeholder="Москва" />
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Конфиденциальность</Text>
          <Pressable onPress={() => setPolicyOpen(true)} style={styles.linkRow}>
            <Text style={styles.link}>Политика конфиденциальности</Text>
          </Pressable>
          {!deleting ? (
            <Pressable onPress={() => setDeleting(true)} style={styles.linkRow}>
              <Text style={styles.danger}>Удалить аккаунт</Text>
            </Pressable>
          ) : (
            <View style={styles.deleteBox}>
              <Text style={styles.deleteText}>
                Аккаунт и все ваши данные будут удалены навсегда: профиль, отзывы, посты, комментарии, сообщения и загруженные файлы.
                Личные переписки исчезнут и у собеседников. Отменить это нельзя.
              </Text>
              <TextField label="Пароль" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry placeholder="Введите пароль" />
              {deleteError && <Text style={styles.error}>{deleteError}</Text>}
              <Button title="Удалить аккаунт навсегда" onPress={confirmDelete} loading={deleteBusy} style={{ backgroundColor: colors.danger }} />
              <Button title="Отмена" variant="outline" onPress={() => { setDeleting(false); setDeletePassword(""); setDeleteError(null); }} style={{ marginTop: spacing.sm }} />
            </View>
          )}
        </View>
        <PrivacyPolicyModal visible={policyOpen} onClose={() => setPolicyOpen(false)} />
      </ScrollView>
      </Animated.View>
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
  linkRow: { paddingVertical: spacing.sm },
  link: { color: colors.primary, fontWeight: "700", fontSize: 15 },
  danger: { color: colors.danger, fontWeight: "700", fontSize: 15 },
  deleteBox: { gap: spacing.xs, borderWidth: 1, borderColor: colors.danger, borderRadius: 14, padding: spacing.md },
  deleteText: { ...typography.body, marginBottom: spacing.sm },
  email: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm },
});
