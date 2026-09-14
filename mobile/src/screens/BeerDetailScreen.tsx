import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { LoadingView, ErrorView } from "../components/StateViews";
import { MatchBadge } from "../components/MatchBadge";
import { TasteRadar } from "../components/TasteRadar";
import { StarRating } from "../components/StarRating";
import { TextField } from "../components/TextField";
import { Button } from "../components/Button";
import { BeerCard } from "../components/BeerCard";
import { beersApi, tasteProfileApi } from "../api/beervia";
import { apiErrorMessage } from "../api/client";
import { colors, radius, spacing, typography } from "../theme/colors";
import { BeerDetail, TasteProfile } from "../types";

type RouteParams = { beerId: string };

export function BeerDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { beerId } = route.params as RouteParams;

  const [beer, setBeer] = useState<BeerDetail | null>(null);
  const [userProfile, setUserProfile] = useState<TasteProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [detail, taste] = await Promise.all([beersApi.detail(beerId), tasteProfileApi.get()]);
      setBeer(detail);
      setUserProfile(taste.profile);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить пиво"));
    } finally {
      setLoading(false);
    }
  }, [beerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitReview() {
    if (!beer || myRating === 0) return;
    setSubmitting(true);
    try {
      await beersApi.review(beer.id, myRating, myText.trim() || undefined);
      await load();
      setMyText("");
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось сохранить отзыв"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingView label="Загружаем карточку пива…" />;
  if (error || !beer) return <ErrorView message={error ?? "Пиво не найдено"} onRetry={load} />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {beer.imageUrl ? (
          <Image source={{ uri: beer.imageUrl }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Text style={{ fontSize: 48 }}>🍺</Text>
          </View>
        )}

        <Text style={styles.name}>{beer.name}</Text>
        <Text style={styles.brewery}>{beer.brewery.name} · {beer.brewery.country}</Text>
        <Text style={styles.style}>{beer.style} · {beer.abv}% ABV{beer.ibu ? ` · ${beer.ibu} IBU` : ""}</Text>

        <View style={styles.row}>
          {beer.matchPercent != null && <MatchBadge percent={beer.matchPercent} />}
          {beer.avgRating != null && (
            <View style={styles.ratingRow}>
              <StarRating rating={beer.avgRating} />
              <Text style={styles.ratingText}>{beer.avgRating} ({beer.reviews.length})</Text>
            </View>
          )}
        </View>

        <Text style={styles.description}>{beer.description}</Text>

        <Text style={styles.sectionTitle}>Вкусовой профиль</Text>
        <View style={styles.radarWrap}>
          <TasteRadar profile={beer.tasteProfile} secondaryProfile={userProfile ?? undefined} size={260} />
          {userProfile && (
            <View style={styles.legend}>
              <LegendDot color={colors.primary} label="Это пиво" />
              <LegendDot color={colors.accent} label="Ваш вкус" />
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Сочетается с</Text>
        <View style={styles.chips}>
          {beer.foodPairings.map((food) => (
            <View key={food} style={styles.chip}>
              <Text style={styles.chipText}>{food}</Text>
            </View>
          ))}
        </View>

        {beer.recommendations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Рекомендации</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              {beer.recommendations.map((rec) => (
                <View key={rec.id} style={styles.recCard}>
                  <BeerCard
                    name={rec.name}
                    style={rec.style}
                    breweryName={rec.brewery.name}
                    imageUrl={rec.imageUrl}
                    matchPercent={rec.matchPercent}
                    onPress={() => navigation.push("BeerDetail", { beerId: rec.id })}
                  />
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTitle}>Ваш отзыв</Text>
        <View style={styles.reviewForm}>
          <StarRating rating={myRating} onChange={setMyRating} size={28} />
          <TextField
            label="Комментарий (необязательно)"
            value={myText}
            onChangeText={setMyText}
            placeholder="Что понравилось или нет?"
            multiline
          />
          <Button title="Сохранить отзыв" onPress={submitReview} loading={submitting} disabled={myRating === 0} />
        </View>

        <Text style={styles.sectionTitle}>Отзывы ({beer.reviews.length})</Text>
        {beer.reviews.length === 0 && <Text style={styles.empty}>Пока никто не оставил отзыв — будьте первым!</Text>}
        {beer.reviews.map((r) => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUser}>{r.user.name}</Text>
              <StarRating rating={r.rating} size={14} />
            </View>
            {r.text && <Text style={styles.reviewText}>{r.text}</Text>}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { width: "100%", height: 200, borderRadius: radius.lg, backgroundColor: colors.card },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  name: { ...typography.title, marginTop: spacing.md },
  brewery: { ...typography.body, color: colors.textMuted },
  style: { ...typography.caption, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  ratingText: { ...typography.caption },
  description: { ...typography.body, marginTop: spacing.md, lineHeight: 22 },
  sectionTitle: { ...typography.heading, marginTop: spacing.lg, marginBottom: spacing.sm },
  radarWrap: { alignItems: "center" },
  legend: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.caption },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { color: colors.text, fontSize: 13 },
  recCard: { width: 220, marginRight: spacing.sm },
  reviewForm: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  empty: { ...typography.caption },
  reviewCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  reviewUser: { fontWeight: "700", color: colors.text },
  reviewText: { color: colors.text },
});
