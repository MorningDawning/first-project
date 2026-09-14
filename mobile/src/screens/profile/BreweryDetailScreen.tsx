import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BeerCard } from "../../components/BeerCard";
import { ErrorView, LoadingView } from "../../components/StateViews";
import { breweriesApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { spacing, typography } from "../../theme/colors";
import { ProfileStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "BreweryDetail">;

export function BreweryDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { breweryId } = route.params as { breweryId: string };

  const [brewery, setBrewery] = useState<Awaited<ReturnType<typeof breweriesApi.detail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await breweriesApi.detail(breweryId);
      setBrewery(data);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить пивоварню"));
    } finally {
      setLoading(false);
    }
  }, [breweryId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingView label="Загружаем пивоварню…" />;
  if (error || !brewery) return <ErrorView message={error ?? "Пивоварня не найдена"} onRetry={load} />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.name}>{brewery.name}</Text>
        <Text style={styles.location}>{brewery.country}{brewery.city ? `, ${brewery.city}` : ""}</Text>
        {brewery.description && <Text style={styles.description}>{brewery.description}</Text>}

        <Text style={styles.sectionTitle}>Сорта пива ({brewery.beers.length})</Text>
        {brewery.beers.map((b) => (
          <BeerCard
            key={b.id}
            name={b.name}
            style={b.style}
            breweryName={brewery.name}
            imageUrl={b.imageUrl}
            onPress={() => navigation.navigate("BeerDetail", { beerId: b.id })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  name: { ...typography.title },
  location: { ...typography.caption, marginTop: 2, marginBottom: spacing.md },
  description: { ...typography.body, lineHeight: 22, marginBottom: spacing.lg },
  sectionTitle: { ...typography.heading, marginBottom: spacing.sm },
});
