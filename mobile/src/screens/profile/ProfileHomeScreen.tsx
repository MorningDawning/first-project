import React, { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/beervia";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { ProfileStackParamList } from "../../navigation/types";
import { UserProfile } from "../../types";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ProfileHome">;

const MENU: { key: keyof ProfileStackParamList; label: string; emoji: string; description: string }[] = [
  { key: "TasteProfile", label: "Вкусовой профиль", emoji: "🎯", description: "Что вы любите, по данным сканирований и отзывов" },
  { key: "Breweries", label: "Пивоварни мира", emoji: "🌍", description: "Библиотека пивоварен со всего света" },
  { key: "FriendsFeed", label: "Лента друзей", emoji: "📸", description: "Посты и находки других пользователей" },
  { key: "Settings", label: "Настройки", emoji: "⚙️", description: "Профиль, аккаунт, выход" },
];

export function ProfileHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(authUser);

  useFocusEffect(
    useCallback(() => {
      userApi.me().then(setProfile).catch(() => {});
    }, [])
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{profile?.name?.[0]?.toUpperCase() ?? "?"}</Text>
            </View>
          )}
          <Text style={styles.name}>{profile?.name}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Отсканировано" value={profile?.stats.scanCount ?? 0} />
          <StatCard label="Отзывов" value={profile?.stats.reviewCount ?? 0} />
        </View>

        <View style={styles.menu}>
          {MENU.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => navigation.navigate(item.key as any)}
            >
              <Text style={styles.menuEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 32, fontWeight: "700" },
  name: { ...typography.heading, marginTop: spacing.sm },
  email: { ...typography.caption },
  bio: { ...typography.body, textAlign: "center", marginTop: spacing.sm },
  statsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statValue: { fontSize: 24, fontWeight: "700", color: colors.primary },
  statLabel: { ...typography.caption },
  menu: { gap: spacing.sm },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  menuItemPressed: { opacity: 0.8 },
  menuEmoji: { fontSize: 24 },
  menuLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  menuDescription: { ...typography.caption },
  chevron: { fontSize: 22, color: colors.textMuted },
});
