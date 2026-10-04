import React, { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { useAuth } from "../../context/AuthContext";
import { userApi, tasteProfileApi } from "../../api/beervia";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { ProfileStackParamList } from "../../navigation/types";
import { TasteProfile, TasteProfileResponse, UserProfile } from "../../types";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ProfileHome">;

const MENU: { key: keyof ProfileStackParamList; label: string; emoji: string; description: string }[] = [
  { key: "Breweries", label: "Пивоварни мира", emoji: "🌍", description: "Библиотека пивоварен со всего света" },
  { key: "Settings", label: "Настройки", emoji: "⚙️", description: "Профиль, аккаунт, выход" },
];

const TASTE_ROWS: { axis: keyof TasteProfile; short: string }[] = [
  { axis: "sweetness", short: "Сладость" },
  { axis: "bitterness", short: "Горечь" },
  { axis: "sourness", short: "Кислота" },
  { axis: "aroma", short: "Хмель" },
  { axis: "body", short: "Тело" },
];

export function ProfileHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(authUser);
  const [taste, setTaste] = useState<TasteProfileResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      userApi.me().then(setProfile).catch(() => {});
      tasteProfileApi.get().then(setTaste).catch(() => {});
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
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>{profile?.name}</Text>
            <Text style={styles.email} numberOfLines={1}>{profile?.email}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard value={profile?.stats.scanCount ?? 0} label="скана" />
          <StatCard value={profile?.stats.reviewCount ?? 0} label="отзывов" />
          <StatCard value={taste?.stylesTried ?? 0} label="стилей" />
        </View>

        {taste?.hasEnoughData && taste.profile && (
          <Pressable
            onPress={() => navigation.navigate("TasteProfile")}
            style={({ pressed }) => [styles.tasteCard, pressed && styles.tasteCardPressed]}
          >
            <View style={styles.tasteHeader}>
              <View>
                <Text style={styles.tasteEyebrow}>Вкусовой профиль</Text>
                <Text style={styles.tasteTitle}>{taste.personaTitle}</Text>
              </View>
              <Text style={styles.tasteChevron}>›</Text>
            </View>

            <View style={styles.tasteChart}>
              {TASTE_ROWS.map((row) => (
                <View key={row.axis} style={styles.tasteBarCol}>
                  <View style={styles.tasteBarTrack}>
                    <View style={[styles.tasteBarFill, { height: `${taste.profile![row.axis]}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.tasteLabels}>
              {TASTE_ROWS.map((row) => (
                <Text key={row.axis} style={styles.tasteLabel}>{row.short}</Text>
              ))}
            </View>
          </Pressable>
        )}

        <View style={styles.menu}>
          {MENU.map((item, i) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.menuItem,
                i > 0 && styles.menuItemDivider,
                pressed && styles.menuItemPressed,
              ]}
              onPress={() => navigation.navigate(item.key as never)}
            >
              <View style={styles.menuIconWrap}>
                <Text style={styles.menuEmoji}>{item.emoji}</Text>
              </View>
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

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },

  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.display, color: colors.background, fontSize: 28 },
  headerText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  statValue: { fontFamily: fonts.display, fontSize: 24, color: colors.primary },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },

  tasteCard: { backgroundColor: colors.text, borderRadius: radius.lg, padding: spacing.md + 4, marginBottom: spacing.md, gap: spacing.md },
  tasteCardPressed: { opacity: 0.92 },
  tasteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tasteEyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "#C9BEB0" },
  tasteTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.background, marginTop: 4 },
  tasteChevron: { fontSize: 22, color: colors.background },
  tasteChart: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, height: 64 },
  tasteBarCol: { flex: 1, height: "100%", justifyContent: "flex-end" },
  tasteBarTrack: { height: "100%", justifyContent: "flex-end" },
  tasteBarFill: { width: "100%", borderRadius: 8, backgroundColor: colors.accent, minHeight: 6 },
  tasteLabels: { flexDirection: "row", gap: spacing.sm },
  tasteLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 10, color: "#C9BEB0", textAlign: "center" },

  menu: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  menuItemDivider: { borderTopWidth: 1, borderTopColor: colors.background },
  menuItemPressed: { opacity: 0.7 },
  menuIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  menuEmoji: { fontSize: 18 },
  menuLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  menuDescription: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  chevron: { fontSize: 22, color: colors.textMuted },
});
