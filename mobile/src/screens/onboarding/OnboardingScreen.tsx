import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { BeerArt } from "../../components/BeerArt";
import { beersApi } from "../../api/beervia";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { BeerSummary } from "../../types";

type Props = { onDone: () => void };

export function OnboardingScreen({ onDone }: Props) {
  const [beers, setBeers] = useState<BeerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    beersApi
      .onboarding()
      .then(setBeers)
      .catch(() => setBeers([]))
      .finally(() => setLoading(false));
  }, []);

  async function rate(beerId: string, rating: number) {
    setSavingId(beerId);
    setRatings((prev) => ({ ...prev, [beerId]: rating }));
    try {
      await beersApi.review(beerId, rating);
    } catch {
      // Молча пропускаем — это необязательный опрос, не хотим блокировать онбординг ошибкой сети.
    } finally {
      setSavingId(null);
    }
  }

  const ratedCount = Object.keys(ratings).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Давайте познакомимся</Text>
        <Text style={styles.subtitle}>
          Оцените несколько разных сортов — так мы быстрее подберём вкусовой профиль и будем
          показывать пиво, которое вам действительно понравится.
        </Text>

        {ratedCount > 0 && (
          <Text style={styles.progress}>{ratedCount} из {beers.length} оценено</Text>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.list}>
            {beers.map((beer) => {
              const rating = ratings[beer.id];
              return (
                <View key={beer.id} style={styles.row}>
                  <BeerArt name={beer.name} imageUrl={beer.imageUrl} size={52} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>{beer.name}</Text>
                    <Text style={styles.rowStyle} numberOfLines={1}>{beer.brewery.name} · {beer.style}</Text>
                  </View>
                  <View style={styles.rowButtons}>
                    <Pressable
                      onPress={() => rate(beer.id, 2)}
                      disabled={savingId === beer.id}
                      style={[styles.rowButton, rating != null && rating <= 2 && styles.rowButtonDown]}
                    >
                      <Text style={styles.rowButtonIcon}>👎</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => rate(beer.id, 5)}
                      disabled={savingId === beer.id}
                      style={[styles.rowButton, rating != null && rating >= 4 && styles.rowButtonUp]}
                    >
                      <Text style={styles.rowButtonIcon}>👍</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Button
          title={ratedCount > 0 ? "Готово" : "Пропустить"}
          onPress={onDone}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { ...typography.title },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  progress: { ...typography.caption, color: colors.success, fontWeight: "700", marginTop: spacing.md },
  list: { marginTop: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowStyle: { fontSize: 12, color: colors.textMuted },
  rowButtons: { flexDirection: "row", gap: spacing.xs },
  rowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rowButtonDown: { borderColor: colors.primary, backgroundColor: "#FBEAE3" },
  rowButtonUp: { borderColor: colors.success, backgroundColor: "#E9F1EC" },
  rowButtonIcon: { fontSize: 16 },
});
