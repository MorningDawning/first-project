import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { LoadingView, ErrorView } from "../components/StateViews";
import { MatchRing } from "../components/MatchRing";
import { StarRating } from "../components/StarRating";
import { Button } from "../components/Button";
import { BeerCard } from "../components/BeerCard";
import { BeerArt } from "../components/BeerArt";
import { RatingSheet } from "../components/RatingSheet";
import { beersApi, barApi, tasteProfileApi, wishlistApi } from "../api/beervia";
import { apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, fonts, matchTint, radius, spacing, typography } from "../theme/colors";
import { explainMatch, matchHeadline } from "../lib/matchExplain";
import { BeerDetail, TasteProfile } from "../types";

type RouteParams = { beerId: string };

const COMPARE_ROWS: { axis: keyof TasteProfile; label: string }[] = [
  { axis: "sweetness", label: "Сладость" },
  { axis: "bitterness", label: "Горечь" },
  { axis: "sourness", label: "Кислотность" },
  { axis: "aroma", label: "Аромат хмеля" },
  { axis: "body", label: "Плотность" },
];

export function BeerDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { beerId } = route.params as RouteParams;
  const { user } = useAuth();

  const [beer, setBeer] = useState<BeerDetail | null>(null);
  const [userProfile, setUserProfile] = useState<TasteProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [addingToBar, setAddingToBar] = useState(false);
  const [barAdded, setBarAdded] = useState(false);

  const [ratingOpen, setRatingOpen] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

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

  const myReview = useMemo(() => beer?.reviews.find((r) => r.user.id === user?.id) ?? null, [beer, user?.id]);

  async function toggleWishlist() {
    if (!beer || wishlistBusy) return;
    setWishlistBusy(true);
    const next = !beer.isWishlisted;
    setBeer({ ...beer, isWishlisted: next });
    try {
      await (next ? wishlistApi.add(beer.id) : wishlistApi.remove(beer.id));
    } catch {
      setBeer((prev) => (prev ? { ...prev, isWishlisted: !next } : prev));
    } finally {
      setWishlistBusy(false);
    }
  }

  async function addToBar() {
    if (!beer || addingToBar) return;
    setAddingToBar(true);
    try {
      await barApi.add(beer.id);
      setBarAdded(true);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось добавить в бар"));
    } finally {
      setAddingToBar(false);
    }
  }

  async function saveReview(rating: number, text: string, tags: string[]) {
    if (!beer) return;
    setSavingReview(true);
    try {
      await beersApi.review(beer.id, rating, text.trim() || undefined, tags);
      setRatingOpen(false);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось сохранить отзыв"));
    } finally {
      setSavingReview(false);
    }
  }

  if (loading) return <LoadingView label="Загружаем карточку пива…" />;
  if (error || !beer) return <ErrorView message={error ?? "Пиво не найдено"} onRetry={load} />;

  const matchPercent = beer.matchPercent;
  const tint = matchPercent != null ? matchTint(matchPercent) : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.decoCircle} />

        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.roundBtn} hitSlop={8}>
            <Text style={styles.roundBtnIcon}>←</Text>
          </Pressable>
          <Pressable onPress={toggleWishlist} style={styles.roundBtn} hitSlop={8}>
            <Text style={styles.roundBtnIcon}>{beer.isWishlisted ? "♥" : "♡"}</Text>
          </Pressable>
        </View>

        <View style={styles.headerRow}>
          <BeerArt name={beer.name} imageUrl={beer.imageUrl} size={96} shape="rounded" />
          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={2}>{beer.name}</Text>
            <Text style={styles.brewery} numberOfLines={1}>{beer.brewery.name} · {beer.brewery.country}</Text>
            {beer.avgRating != null && (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingStar}>★</Text>
                <Text style={styles.ratingValue}>{beer.avgRating}</Text>
                <Text style={styles.ratingCount}>· {beer.reviews.length} оценок</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.chipRow}>
          <View style={styles.chip}><Text style={styles.chipText}>{beer.style}</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>{beer.abv}%</Text></View>
          {beer.ibu != null && <View style={styles.chip}><Text style={styles.chipText}>{beer.ibu} IBU</Text></View>}
        </View>

        {matchPercent != null && tint && userProfile && (
          <View style={[styles.matchCard, { backgroundColor: tint.bg }]}>
            <MatchRing percent={matchPercent} size={84} strokeWidth={7} trackColor="rgba(0,0,0,0.08)">
              <Text style={[styles.matchRingText, { color: tint.fg }]}>{matchPercent}%</Text>
            </MatchRing>
            <View style={styles.matchText}>
              <Text style={[styles.matchHeadline, { color: tint.fg }]}>{matchHeadline(matchPercent)}</Text>
              <Text style={[styles.matchExplain, { color: tint.fg }]}>
                {explainMatch(beer.tasteProfile, userProfile)}
              </Text>
            </View>
          </View>
        )}

        {userProfile && (
          <View style={styles.compareCard}>
            <View style={styles.compareHeader}>
              <Text style={styles.compareTitle}>Ты и это пиво</Text>
              <View style={styles.compareLegend}>
                <View style={styles.legendItem}>
                  <View style={styles.legendDotYou} />
                  <Text style={styles.legendLabel}>Ты</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendDotBeer} />
                  <Text style={styles.legendLabel}>Пиво</Text>
                </View>
              </View>
            </View>
            {COMPARE_ROWS.map((row) => (
              <View key={row.axis} style={styles.compareRow}>
                <Text style={styles.compareLabel}>{row.label}</Text>
                <View style={styles.compareTrack}>
                  <View style={[styles.compareBar, { width: `${beer.tasteProfile[row.axis]}%` }]} />
                  <View style={[styles.compareDot, { left: `${userProfile[row.axis]}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.description}>{beer.description}</Text>

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

        <Text style={styles.sectionTitle}>Отзывы ({beer.reviews.length})</Text>
        {beer.reviews.length === 0 && <Text style={styles.empty}>Пока никто не оставил отзыв — будьте первым!</Text>}
        {beer.reviews.map((r) => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUser}>{r.user.name}</Text>
              <StarRating rating={r.rating} size={14} />
            </View>
            {r.text && <Text style={styles.reviewText}>{r.text}</Text>}
            {r.tags.length > 0 && (
              <View style={styles.reviewTags}>
                {r.tags.map((tag) => (
                  <View key={tag} style={styles.reviewTag}>
                    <Text style={styles.reviewTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.actionBar}>
        <Button title="Оценить" variant="outline" onPress={() => setRatingOpen(true)} style={styles.actionRate} />
        <Button
          title={barAdded ? "Добавлено" : "В мой бар"}
          onPress={addToBar}
          loading={addingToBar}
          disabled={barAdded}
          style={styles.actionBar2}
        />
      </View>

      <RatingSheet
        visible={ratingOpen}
        beerName={beer.name}
        imageUrl={beer.imageUrl}
        initialRating={myReview?.rating ?? 0}
        initialText={myReview?.text ?? ""}
        initialTags={myReview?.tags ?? []}
        saving={savingReview}
        onClose={() => setRatingOpen(false)}
        onSave={saveReview}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },

  decoCircle: {
    position: "absolute",
    left: 40,
    top: -110,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: colors.border,
    opacity: 0.5,
  },

  topRow: { flexDirection: "row", justifyContent: "space-between" },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  roundBtnIcon: { fontSize: 20, color: colors.text },

  headerRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md, marginTop: spacing.lg },
  headerInfo: { flex: 1, gap: 4, paddingBottom: 4 },
  name: { fontFamily: fonts.display, fontSize: 26, color: colors.text, lineHeight: 30 },
  brewery: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingStar: { color: colors.accent, fontSize: 14 },
  ratingValue: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  ratingCount: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  chipRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.md },

  matchCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  matchRingText: { fontFamily: fonts.display, fontSize: 17 },
  matchText: { flex: 1, gap: 4 },
  matchHeadline: { fontFamily: fonts.display, fontSize: 18 },
  matchExplain: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },

  compareCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  compareHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  compareTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  compareLegend: { flexDirection: "row", gap: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDotYou: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: colors.text },
  legendDotBeer: { width: 14, height: 8, borderRadius: 9, backgroundColor: colors.primary },
  legendLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  compareRow: { gap: 6 },
  compareLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  compareTrack: { height: 8, borderRadius: 9, backgroundColor: colors.background, position: "relative" },
  compareBar: { height: "100%", borderRadius: 9, backgroundColor: colors.primary },
  compareDot: {
    position: "absolute",
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.text,
  },

  description: { ...typography.body, marginTop: spacing.lg, lineHeight: 22 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  recCard: { width: 220, marginRight: spacing.sm },
  empty: { ...typography.caption },
  reviewCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewUser: { fontFamily: fonts.bodyBold, color: colors.text },
  reviewText: { fontFamily: fonts.body, color: colors.text },
  reviewTags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 2 },
  reviewTag: { backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  reviewTagText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  actionRate: { flex: 1 },
  actionBar2: { flex: 1.4 },
});
