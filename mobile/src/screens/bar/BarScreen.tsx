import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BeerCard } from "../../components/BeerCard";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { barApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { spacing, typography } from "../../theme/colors";
import { BarStackParamList } from "../../navigation/types";
import { BarEntry } from "../../types";

type Nav = NativeStackNavigationProp<BarStackParamList, "BarHome">;

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function BarScreen() {
  const navigation = useNavigation<Nav>();
  const [entries, setEntries] = useState<BarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await barApi.list();
      setEntries(data);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить бар"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <Text style={styles.title}>Мой бар</Text>
      <Text style={styles.subtitle}>Всё, что вы уже отсканировали</Text>

      {loading ? (
        <LoadingView label="Загружаем бар…" />
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : entries.length === 0 ? (
        <EmptyView emoji="🍻" message="Пока пусто — отсканируйте своё первое пиво на вкладке «Сканер»" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.scanId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BeerCard
              name={item.beer.name}
              style={item.beer.style}
              breweryName={item.beer.brewery.name}
              imageUrl={item.beer.imageUrl}
              subtitle={formatDate(item.scannedAt)}
              onPress={() => navigation.navigate("BeerDetail", { beerId: item.beer.id })}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  subtitle: { ...typography.caption, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
