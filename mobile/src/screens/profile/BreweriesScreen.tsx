import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { breweriesApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { ProfileStackParamList } from "../../navigation/types";
import { Brewery } from "../../types";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Breweries">;

export function BreweriesScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const [breweries, setBreweries] = useState<Brewery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      const data = await breweriesApi.list(q || undefined);
      setBreweries(data);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить пивоварни"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  return (
    <Screen>
      <View style={styles.header}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск пивоварни или страны"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />
      </View>

      {loading ? (
        <LoadingView label="Загружаем пивоварни…" />
      ) : error ? (
        <ErrorView message={error} onRetry={() => load(query)} />
      ) : breweries.length === 0 ? (
        <EmptyView emoji="🌍" message="Пивоварни не найдены" />
      ) : (
        <FlatList
          data={breweries}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
              onPress={() => navigation.navigate("BreweryDetail", { breweryId: item.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.country}{item.city ? `, ${item.city}` : ""}</Text>
              </View>
              <Text style={styles.count}>{item.beerCount} сортов</Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  meta: { ...typography.caption, marginTop: 2 },
  count: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
