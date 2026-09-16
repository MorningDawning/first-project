import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { TasteRadar } from "../../components/TasteRadar";
import { LoadingView, ErrorView, EmptyView } from "../../components/StateViews";
import { tasteProfileApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { TasteProfileResponse } from "../../types";

const AXIS_LABELS: Record<string, string> = {
  sweetness: "Сладость",
  bitterness: "Горечь",
  sourness: "Кислотность",
  body: "Плотность",
  aroma: "Аромат",
};

export function TasteProfileScreen() {
  const [data, setData] = useState<TasteProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setLoading(true);
    tasteProfileApi
      .get()
      .then(setData)
      .catch((e) => setError(apiErrorMessage(e, "Не удалось загрузить вкусовой профиль")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <LoadingView label="Анализируем ваш вкус…" />;
  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!data?.hasEnoughData || !data.profile) {
    return (
      <Screen>
        <EmptyView
          emoji="🎯"
          message="Недостаточно данных. Отсканируйте и оцените несколько сортов пива — и мы построим ваш вкусовой профиль."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ваш вкусовой профиль</Text>
        <Text style={styles.subtitle}>
          Построен по {data.beersScanned} отсканированным сортам и вашим оценкам
        </Text>

        <View style={styles.radarWrap}>
          <TasteRadar profile={data.profile} size={280} />
        </View>

        {data.favoriteStyle && (
          <View style={styles.favoriteCard}>
            <Text style={styles.favoriteLabel}>Любимый стиль</Text>
            <Text style={styles.favoriteValue}>{data.favoriteStyle}</Text>
          </View>
        )}

        <View style={styles.breakdown}>
          {Object.entries(data.profile).map(([key, value]) => (
            <View key={key} style={styles.barRow}>
              <Text style={styles.barLabel}>{AXIS_LABELS[key] ?? key}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${value}%` }]} />
              </View>
              <Text style={styles.barValue}>{value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { ...typography.title },
  subtitle: { ...typography.caption, marginTop: spacing.xs, marginBottom: spacing.md },
  radarWrap: { alignItems: "center", marginBottom: spacing.lg },
  favoriteCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  favoriteLabel: { ...typography.caption },
  favoriteValue: { fontSize: 20, fontWeight: "700", color: colors.primary, marginTop: 2 },
  breakdown: { gap: spacing.md },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { width: 90, fontSize: 13, color: colors.text },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.success, borderRadius: 4 },
  barValue: { width: 28, textAlign: "right", fontSize: 13, color: colors.textMuted },
});
