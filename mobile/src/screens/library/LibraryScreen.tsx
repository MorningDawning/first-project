import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BeerCard } from "../../components/BeerCard";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { beersApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { HomeStackParamList } from "../../navigation/types";
import { BeerSummary } from "../../types";

type Nav = NativeStackNavigationProp<HomeStackParamList, "Catalog">;

export function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<HomeStackParamList, "Catalog">>();
  const [query, setQuery] = useState("");
  const [styles_, setStyles] = useState<string[]>([]);
  const [activeStyle, setActiveStyle] = useState<string | null>(route.params?.style ?? null);
  const [beers, setBeers] = useState<BeerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    beersApi.styles().then(setStyles).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const results = await beersApi.search({ q: query || undefined, style: activeStyle || undefined });
      // По умолчанию сортируем по совпадению со вкусом — так библиотека сразу
      // ведёт к тому, что вероятнее понравится, а не к алфавиту.
      results.sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1));
      setBeers(results);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить библиотеку"));
    } finally {
      setLoading(false);
    }
  }, [query, activeStyle]);

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [load]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>Библиотека</Text>
        </View>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⚲</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Название, пивоварня, стиль"
            placeholderTextColor={colors.textMuted}
            autoFocus={route.params?.focusSearch}
            style={styles.search}
          />
        </View>
      </View>

      {styles_.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["Все", ...styles_]}
          keyExtractor={(s) => s}
          style={styles.filtersList}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const isActive = item === "Все" ? activeStyle === null : activeStyle === item;
            return (
              <Pressable
                onPress={() => setActiveStyle(item === "Все" ? null : item)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{item}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {!loading && !error && beers.length > 0 && (
        <View style={styles.metaRow}>
          <Text style={styles.metaCount}>{beers.length} {pluralBeers(beers.length)}</Text>
          <Text style={styles.metaSort}>По совпадению ↓</Text>
        </View>
      )}

      {loading ? (
        <LoadingView label="Ищем пиво…" />
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : beers.length === 0 ? (
        <EmptyView message="Ничего не найдено — попробуйте другой запрос" />
      ) : (
        <FlatList
          data={beers}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BeerCard
              name={item.name}
              style={item.style}
              breweryName={item.brewery.name}
              imageUrl={item.imageUrl}
              matchPercent={item.matchPercent}
              onPress={() => navigation.navigate("BeerDetail", { beerId: item.id })}
            />
          )}
        />
      )}
    </Screen>
  );
}

function pluralBeers(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "сорт";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "сорта";
  return "сортов";
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: spacing.md },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 20, color: colors.text },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  searchIcon: { fontSize: 16, color: colors.textMuted },
  search: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  filtersList: { flexGrow: 0, height: 48, marginBottom: spacing.xs },
  filters: { paddingHorizontal: spacing.lg, alignItems: "center" },
  filterChip: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.text },
  filterText: { fontFamily: fonts.bodySemiBold, color: colors.text, fontSize: 13, lineHeight: 16 },
  filterTextActive: { color: colors.background },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  metaCount: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  metaSort: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
