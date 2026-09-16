import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
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
import { BeerArt } from "../components/BeerArt";
import { beersApi, tasteProfileApi } from "../api/beervia";
import { apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/colors";
import { BeerDetail, TasteProfile } from "../types";

type RouteParams = { beerId: string };

const HERO_HEIGHT = 260;
const BOTTLE_SIZE = 92;

export function BeerDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { beerId } = route.params as RouteParams;
  const { user } = useAuth();

  const [beer, setBeer] = useState<BeerDetail | null>(null);
  const [userProfile, setUserProfile] = useState<TasteProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroFailed, setHeroFailed] = useState(false);

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
      const own = detail.reviews.find((r) => r.user.id === user?.id);
      if (own) {
        setMyRating(own.rating);
        setMyText(own.text ?? "");
      }
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить пиво"));
    } finally {
      setLoading(false);
    }
  }, [beerId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const myReview = useMemo(() => beer?.reviews.find((r) => r.user.id === user?.id) ?? null, [beer, user?.id]);

  async function rate(rating: number) {
    if (!beer) return;
    setError(null);
    setMyRating(rating);
    setSubmitting(true);
    try {
      await beersApi.review(beer.id, rating, myText.trim() || undefined);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось сохранить отзыв"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReview() {
    if (!beer || myRating === 0) return;
    await rate(myRating);
  }

  if (loading) return <LoadingView label="Загружаем карточку пива…" />;
  if (error || !beer) return <ErrorView message={error ?? "Пиво не найдено"} onRetry={load} />;

  // Одно и то же фото пива — размытым фоном и чётким кружком. Раньше фон брался
  // у пивоварни (фото другого её сорта), из-за чего марка «терялась» на фоне
  // визуально не связанной картинки — теперь и фон, и кружок про именно это пиво.
  const heroUrl = beer.imageUrl;

  return (
    <Screen style={{ backgroundColor: colors.card }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {heroUrl && !heroFailed ? (
            <Image
              source={{ uri: heroUrl }}
              style={StyleSheet.absoluteFill}
              blurRadius={22}
              onError={() => setHeroFailed(true)}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />
          )}
          <View style={styles.heroShade} />

          {beer.avgRating != null && (
            <View style={styles.ratingFloating}>
              <Text style={styles.ratingFloatingValue}>{beer.avgRating}</Text>
              <StarRating rating={beer.avgRating} size={12} />
              <Text style={styles.ratingFloatingCount}>{beer.reviews.length} оценок</Text>
            </View>
          )}

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroBrewery} numberOfLines={1}>
              {beer.brewery.name} · {beer.brewery.country}
            </Text>
            <Text style={styles.heroName} numberOfLines={2}>
              {beer.name}
            </Text>
          </View>
        </View>

        <View style={styles.bottleWrap}>
          <BeerArt name={beer.name} imageUrl={beer.imageUrl} size={BOTTLE_SIZE} shape="circle" style={styles.bottle} />
        </View>

        <View style={styles.body}>
          <Text style={styles.style}>{beer.style} · {beer.abv}% ABV{beer.ibu ? ` · ${beer.ibu} IBU` : ""}</Text>

          {beer.matchPercent != null && (
            <View style={{ marginTop: spacing.sm }}>
              <MatchBadge percent={beer.matchPercent} />
            </View>
          )}

          <View style={styles.likeRow}>
            <Text style={styles.likeQuestion}>Вам нравится это пиво?</Text>
            <View style={styles.likeButtons}>
              <Pressable
                onPress={() => rate(2)}
                disabled={submitting}
                style={[styles.likeButton, myReview && myReview.rating <= 2 && styles.likeButtonActiveDown]}
              >
                <Text style={styles.likeIcon}>👎</Text>
              </Pressable>
              <Pressable
                onPress={() => rate(5)}
                disabled={submitting}
                style={[styles.likeButton, myReview && myReview.rating >= 4 && styles.likeButtonActiveUp]}
              >
                <Text style={styles.likeIcon}>👍</Text>
              </Pressable>
            </View>
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
        </View>
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
  content: { paddingBottom: spacing.xl * 2 },

  hero: {
    height: HERO_HEIGHT,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
    backgroundColor: colors.card,
    justifyContent: "flex-end",
  },
  heroFallback: { backgroundColor: colors.primary },
  heroShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(44,24,16,0.45)",
  },
  heroTextBlock: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: "40%",
    gap: 2,
  },
  heroBrewery: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowRadius: 4,
  },
  heroName: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowRadius: 6,
  },

  ratingFloating: {
    position: "absolute",
    top: spacing.md,
    right: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    alignItems: "center",
    gap: 2,
  },
  ratingFloatingValue: { fontSize: 18, fontWeight: "700", color: colors.text },
  ratingFloatingCount: { fontSize: 10, color: colors.textMuted },

  bottleWrap: {
    alignItems: "center",
    marginTop: -(BOTTLE_SIZE / 2),
  },
  bottle: {
    width: BOTTLE_SIZE,
    height: BOTTLE_SIZE,
    borderRadius: BOTTLE_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.card,
    backgroundColor: colors.background,
  },

  body: { paddingHorizontal: spacing.lg, alignItems: "center" },
  style: { ...typography.caption, marginTop: spacing.sm, textAlign: "center" },

  likeRow: {
    marginTop: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    width: "100%",
  },
  likeQuestion: { ...typography.body, fontWeight: "600" },
  likeButtons: { flexDirection: "row", gap: spacing.md },
  likeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  likeButtonActiveDown: { borderColor: colors.primary, backgroundColor: "#FBEAE3" },
  likeButtonActiveUp: { borderColor: colors.success, backgroundColor: "#E9F1EC" },
  likeIcon: { fontSize: 20 },

  description: { ...typography.body, marginTop: spacing.lg, lineHeight: 22, textAlign: "left", alignSelf: "stretch" },
  sectionTitle: { ...typography.heading, marginTop: spacing.lg, marginBottom: spacing.sm, alignSelf: "flex-start" },
  radarWrap: { alignItems: "center", alignSelf: "stretch" },
  legend: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.caption },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignSelf: "flex-start" },
  chip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { color: colors.text, fontSize: 13 },
  recCard: { width: 220, marginRight: spacing.sm },
  reviewForm: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, alignSelf: "stretch" },
  empty: { ...typography.caption, alignSelf: "flex-start" },
  reviewCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, alignSelf: "stretch" },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  reviewUser: { fontWeight: "700", color: colors.text },
  reviewText: { color: colors.text },
});
