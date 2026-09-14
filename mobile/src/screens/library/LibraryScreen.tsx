import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BeerCard } from "../../components/BeerCard";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { beersApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { LibraryStackParamList } from "../../navigation/types";
import { BeerSummary } from "../../types";

type Nav = NativeStackNavigationProp<LibraryStackParamList, "LibraryHome">;

export function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const [styles_, setStyles] = useState<string[]>([]);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
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
        <Text style={styles.title}>Библиотека</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по названию, пивоварне, стилю"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />
      </View>

      {styles_.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["Все", ...styles_]}
          keyExtractor={(s) => s}
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

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { ...typography.title, marginBottom: spacing.sm },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontSize: 13 },
  filterTextActive: { color: "#fff", fontWeight: "700" },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
