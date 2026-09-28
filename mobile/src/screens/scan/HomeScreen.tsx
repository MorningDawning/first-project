import React, { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BeerCard } from "../../components/BeerCard";
import { ForYouCard } from "../../components/ForYouCard";
import { CameraIcon } from "../../components/icons/TabIcons";
import { useAuth } from "../../context/AuthContext";
import { beersApi, barApi } from "../../api/beervia";
import { colors, fonts, radius, spacing, typography } from "../../theme/colors";
import { HomeStackParamList, MainTabParamList } from "../../navigation/types";
import { BarEntry, BeerSummary } from "../../types";

type Nav = NativeStackNavigationProp<HomeStackParamList, "Home">;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [forYou, setForYou] = useState<BeerSummary[]>([]);
  const [recent, setRecent] = useState<BarEntry[]>([]);
  const [matchById, setMatchById] = useState<Map<string, number | null>>(new Map());

  useFocusEffect(
    useCallback(() => {
      Promise.all([beersApi.search({}), barApi.list()])
        .then(([beers, bar]) => {
          const withMatch = beers.filter((b) => b.matchPercent != null);
          withMatch.sort((a, b) => (b.matchPercent ?? 0) - (a.matchPercent ?? 0));
          setForYou(withMatch.slice(0, 6));
          setMatchById(new Map(beers.map((b) => [b.id, b.matchPercent])));
          setRecent(bar.slice(0, 3));
        })
        .catch(() => {});
    }, [])
  );

  const firstName = user?.name?.split(" ")[0];
  const initial = (user?.name?.trim()[0] ?? "B").toUpperCase();

  function openCamera() {
    navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate("CameraTab");
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{firstName ? `Привет, ${firstName}!` : "BeerVia"}</Text>
            <Text style={styles.subtitle}>Что сегодня пьём?</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        <Pressable onPress={openCamera} style={({ pressed }) => [styles.scanCard, pressed && styles.scanCardPressed]}>
          <View style={styles.scanCardText}>
            <Text style={styles.scanCardTitle}>Отсканируй этикетку</Text>
            <Text style={styles.scanCardSubtitle}>Процент совпадения за секунду</Text>
          </View>
          <View style={styles.scanCardIcon}>
            <CameraIcon color={colors.background} size={26} />
          </View>
        </Pressable>

        {forYou.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Для тебя</Text>
            </View>
            <FlatList
              data={forYou}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(b) => b.id}
              contentContainerStyle={styles.forYouList}
              style={styles.forYouRow}
              renderItem={({ item }) => (
                <ForYouCard
                  name={item.name}
                  style={item.style}
                  imageUrl={item.imageUrl}
                  matchPercent={item.matchPercent}
                  onPress={() => navigation.navigate("BeerDetail", { beerId: item.id })}
                />
              )}
            />
          </View>
        )}

        {recent.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Недавние сканы</Text>
            {recent.map((entry) => (
              <BeerCard
                key={entry.scanId}
                name={entry.beer.name}
                style={entry.beer.style}
                breweryName={entry.beer.brewery.name}
                imageUrl={entry.beer.imageUrl}
                matchPercent={matchById.get(entry.beer.id) ?? null}
                onPress={() => navigation.navigate("BeerDetail", { beerId: entry.beer.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { ...typography.title, fontSize: 26 },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: 18, color: colors.background },

  scanCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.text,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  scanCardPressed: { opacity: 0.9 },
  scanCardText: { flex: 1, gap: 4 },
  scanCardTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.background },
  scanCardSubtitle: { fontFamily: fonts.body, fontSize: 14, color: "#C9BEB0" },
  scanCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  section: { marginTop: spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sectionTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.text, marginBottom: spacing.sm },
  forYouRow: { marginTop: spacing.xs },
  forYouList: { gap: spacing.sm },
});
