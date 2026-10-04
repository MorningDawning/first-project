import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainTabParamList } from "../navigation/types";
import { LoadingView, ErrorView } from "../components/StateViews";
import { BeerArt } from "../components/BeerArt";
import { BeerBubbles } from "../components/BeerBubbles";
import { RatingSheet } from "../components/RatingSheet";
import { ICON_PATHS, PathIcon } from "../components/PathIcon";
import { beersApi, barApi, tasteProfileApi, wishlistApi } from "../api/beervia";
import { apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { fonts } from "../theme/colors";
import { matchHeadline, whyMatchRows } from "../lib/matchExplain";
import { beerColor, isDarkBeer, lightness, servingFor, tint } from "../lib/beerLook";
import { BeerDetail, BeerSummary, TasteProfile } from "../types";

// Палитра экрана «Страница как бокал» из макета.
const C = {
  bg: "#f5ead8",
  card: "#f9f4ed",
  ink: "#201e1d",
  ink2: "#474238",
  muted: "#645c50",
  sand: "#ebddc5",
  copper: "#c67139",
  copperDark: "#8c491a",
  amber: "#f3cf7a",
  sage: "#e1eecc",
  sageInk: "#272e1b",
  sageDot: "#56633f",
  peach: "#ffe1d0",
  peachInk: "#643312",
  cream: "#f5ead8",
};

type RouteParams = { beerId: string; scanned?: boolean };
type Lens = "similar" | "lighter" | "bitterer" | "darker";

const LENSES: { id: Lens; label: string }[] = [
  { id: "similar", label: "Похожее" },
  { id: "lighter", label: "Полегче" },
  { id: "bitterer", label: "Погорче" },
  { id: "darker", label: "Темнее" },
];

const EQ_ROWS: { axis: keyof TasteProfile; label: string }[] = [
  { axis: "body", label: "Тело" },
  { axis: "sweetness", label: "Сладость" },
  { axis: "bitterness", label: "Горечь" },
  { axis: "sourness", label: "Кислота" },
  { axis: "aroma", label: "Хмель" },
];

const AVATARS: [string, string][] = [["#ccdbb2", "#272e1b"], ["#ffe1d0", "#643312"], ["#ebddc5", "#474238"], ["#e1eecc", "#3d472b"]];
const avatarColors = (name: string) => AVATARS[[...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) % AVATARS.length];
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const fmt = (n: number) => String(n).replace(".", ",");
const reviewsWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "отзыв" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "отзыва" : "отзывов");

/** Банка или бутылка справа в шапке: настоящее фото, а если его нет, нарисованная бутылка с названием, как в макете. */
function Bottle({ beer, color }: { beer: BeerDetail; color: string }) {
  if (beer.imageUrl) {
    return <BeerArt name={beer.name} imageUrl={beer.imageUrl} size={104} height={210} shape="rounded" style={styles.bottle} />;
  }
  return (
    <View style={styles.drawnBottle}>
      <View style={styles.drawnCap} />
      <View style={[styles.drawnLabel, { backgroundColor: color }]}>
        <Text style={[styles.drawnLabelText, isDarkBeer(beer.style) && { color: C.cream }]} numberOfLines={3}>{beer.name.toUpperCase()}</Text>
      </View>
    </View>
  );
}

/** Пиво из списка «Куда дальше» подходит под выбранный ракурс? */
function fitsLens(lens: Lens, base: BeerDetail, other: BeerSummary): boolean {
  if (lens === "lighter") return other.tasteProfile.body < base.tasteProfile.body || other.abv < base.abv - 0.5;
  if (lens === "bitterer") return other.tasteProfile.bitterness > base.tasteProfile.bitterness + 5;
  if (lens === "darker") return lightness(other.style) < lightness(base.style) - 0.05;
  return true;
}

export function BeerDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const insets = useSafeAreaInsets();
  const { beerId, scanned } = route.params as RouteParams;
  const { user } = useAuth();

  const [beer, setBeer] = useState<BeerDetail | null>(null);
  const [userProfile, setUserProfile] = useState<TasteProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [addingToBar, setAddingToBar] = useState(false);
  const [barAdded, setBarAdded] = useState(false);
  const [lens, setLens] = useState<Lens>("similar");
  const [allReviews, setAllReviews] = useState(false);
  const [head, setHead] = useState({ w: 0, h: 0 }); // размер шапки: по нему рассчитывается подъём пузырьков

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

  // Что чаще всего отмечают в отзывах (теги вкуса из окна оценки).
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of beer?.reviews ?? []) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [beer]);

  const next = useMemo(() => (beer ? beer.recommendations.filter((r) => fitsLens(lens, beer, r)).slice(0, 4) : []), [beer, lens]);

  function shareToFriend() {
    navigation
      .getParent<BottomTabNavigationProp<MainTabParamList>>()
      ?.navigate("FeedTab", { screen: "NewMessage", params: { shareBeerId: beerId } });
  }

  async function toggleWishlist() {
    if (!beer || wishlistBusy) return;
    setWishlistBusy(true);
    const nextValue = !beer.isWishlisted;
    setBeer({ ...beer, isWishlisted: nextValue });
    try {
      await (nextValue ? wishlistApi.add(beer.id) : wishlistApi.remove(beer.id));
    } catch {
      setBeer((prev) => (prev ? { ...prev, isWishlisted: !nextValue } : prev));
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
  const color = beerColor(beer.style);
  const dark = isDarkBeer(beer.style);
  const headInk = dark ? C.cream : C.ink;
  const headSoft = dark ? "#dcd3c4" : "#2e2b25";
  const country = beer.brewery.country && beer.brewery.country !== "Не указана" ? ` · ${beer.brewery.country}` : "";
  const why = userProfile && matchPercent != null ? whyMatchRows(beer.tasteProfile, userProfile) : [];
  const serving = servingFor(beer.style);
  const friendReviews = beer.reviews.filter((r) => r.isFriend);
  const listSource = friendReviews.length > 0 ? friendReviews : beer.reviews;
  const shownReviews = allReviews ? beer.reviews : listSource.slice(0, 3);
  const foamTop = Math.max(insets.top, 12) + 66;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Шапка в цвет пива, сверху пена */}
        <View style={[styles.head, { backgroundColor: color }]} onLayout={(e) => setHead({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <View style={[styles.foam, { height: foamTop }]} />
          <View style={[styles.foamBubbles, { top: foamTop - 20 }]}>
            {[44, 58, 40, 64, 48, 56, 42, 60, 46].map((s, i) => (
              <View key={i} style={{ width: s, height: s, borderRadius: s, backgroundColor: C.card, marginTop: i % 2 ? -12 : -4 }} />
            ))}
          </View>
          <BeerBubbles color={tint(color, 0.4)} width={head.w} height={head.h} foamHeight={foamTop} />

          <View style={[styles.topRow, { marginTop: Math.max(insets.top, 12) + 4 }]}>
            <Pressable onPress={() => navigation.goBack()} style={styles.roundBtn} hitSlop={8}>
              <PathIcon d={ICON_PATHS.back} color={C.ink} size={20} strokeWidth={2.75} />
            </Pressable>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{scanned ? "Отсканировано только что" : "Карточка пива"}</Text>
            </View>
            <Pressable onPress={toggleWishlist} style={styles.roundBtn} hitSlop={8}>
              <PathIcon d={ICON_PATHS.heart} color={beer.isWishlisted ? C.copper : C.ink} size={20} strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <View style={styles.titleCol}>
              <Text style={[styles.brewery, { color: headSoft }]} numberOfLines={1}>{beer.brewery.name}{country}</Text>
              <Text style={[styles.name, { color: headInk }, beer.name.length > 14 && styles.nameLong]} numberOfLines={3}>{beer.name}</Text>
              <View style={styles.chipRow}>
                <View style={[styles.chip, { backgroundColor: C.ink }]}><Text style={[styles.chipText, { color: C.cream }]}>{beer.style}</Text></View>
                {beer.avgRating != null && (
                  <View style={[styles.chip, { backgroundColor: C.amber }]}>
                    <Text style={[styles.chipText, { color: C.ink }]}>★ {fmt(beer.avgRating)} · {beer.reviews.length} {reviewsWord(beer.reviews.length)}</Text>
                  </View>
                )}
              </View>
            </View>
            <Bottle beer={beer} color={color} />
          </View>

          {matchPercent != null && userProfile && (
            <View style={styles.matchCard}>
              <Text style={styles.matchValue}>{matchPercent}%</Text>
              <View style={styles.matchText}>
                <Text style={styles.matchHeadline}>{matchHeadline(matchPercent)}</Text>
                <Text style={styles.matchSub}>
                  {beer.tasteSource === "users" ? "По твоему вкусу и оценкам людей" : "По твоему вкусу и стилю пива"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {why.length > 0 && (
          <>
            <Text style={styles.kicker}>Почему {matchPercent}%</Text>
            <View style={styles.whyList}>
              {why.map((w) => (
                <View key={w.text} style={[styles.whyRow, { backgroundColor: w.good ? C.sage : C.peach }]}>
                  <View style={[styles.whyDot, { backgroundColor: w.good ? C.sageDot : C.copper }]}>
                    <PathIcon d={w.good ? ICON_PATHS.check : ICON_PATHS.warn} color={C.card} size={18} strokeWidth={3} />
                  </View>
                  <Text style={[styles.whyText, { color: w.good ? C.sageInk : C.peachInk }]}>{w.text}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.passport}>
          {[
            { v: `${fmt(beer.abv)}%`, l: "крепость" },
            { v: beer.ibu != null ? String(beer.ibu) : "—", l: "IBU" },
            { v: beer.avgRating != null ? fmt(beer.avgRating) : "—", l: "оценка" },
            { v: String(beer.reviews.length), l: "отзывов" },
          ].map((p) => (
            <View key={p.l} style={styles.passportItem}>
              <Text style={styles.passportValue}>{p.v}</Text>
              <Text style={styles.passportLabel}>{p.l}</Text>
            </View>
          ))}
        </View>

        {/* Вкус столбиками, с отметкой пользователя */}
        <View style={styles.sectionHead}>
          <Text style={styles.h3}>{userProfile ? `Ты и ${beer.name}` : "Вкус"}</Text>
          {userProfile && (
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={styles.legendBeer} /><Text style={styles.legendText}>Пиво</Text></View>
              <View style={styles.legendItem}><View style={styles.legendYou} /><Text style={styles.legendText}>Ты</Text></View>
            </View>
          )}
        </View>
        <View style={styles.eqCard}>
          <View style={styles.eqRow}>
            {EQ_ROWS.map((row) => (
              <View key={row.axis} style={styles.eqTrack}>
                <View style={[styles.eqFill, { height: `${beer.tasteProfile[row.axis]}%` }]} />
                {userProfile && <View style={[styles.eqYou, { bottom: `${Math.min(userProfile[row.axis], 96)}%` }]} />}
              </View>
            ))}
          </View>
          <View style={styles.eqLabels}>
            {EQ_ROWS.map((row) => (
              <Text key={row.axis} style={styles.eqLabel}>{row.label}</Text>
            ))}
          </View>
        </View>
        <Text style={styles.note}>
          {beer.tasteSource === "users"
            ? `Вкус по оценкам пользователей (отметили: ${beer.tasteVotes})`
            : "Вкус — примерная оценка по стилю. Оцените пиво и отметьте вкус, чтобы уточнить."}
        </Text>

        {topTags.length > 0 && (
          <>
            <Text style={styles.h3Block}>Что отмечают в отзывах</Text>
            <View style={styles.wrap}>
              {topTags.map(([tag, count]) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Text style={styles.tagCount}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {beer.description ? <Text style={styles.description}>{beer.description}</Text> : null}

        <Text style={styles.h3Block}>Как подать</Text>
        <View style={styles.serveRow}>
          <View style={[styles.serveCard, { backgroundColor: C.sage }]}>
            <PathIcon d={ICON_PATHS.temp} color={C.sageInk} size={24} />
            <View>
              <Text style={[styles.serveValue, { color: C.sageInk }]}>{serving.temp}</Text>
              <Text style={[styles.serveLabel, { color: C.sageInk }]}>{serving.tempNote}</Text>
            </View>
          </View>
          <View style={[styles.serveCard, { backgroundColor: C.peach }]}>
            <PathIcon d={ICON_PATHS.glass} color={C.peachInk} size={24} />
            <View>
              <Text style={[styles.serveValue, { color: C.peachInk }]}>{serving.glass}</Text>
              <Text style={[styles.serveLabel, { color: C.peachInk }]}>{serving.glassNote}</Text>
            </View>
          </View>
        </View>
        {beer.foodPairings.length > 0 && (
          <View style={[styles.wrap, { paddingTop: 12 }]}>
            {beer.foodPairings.map((food) => (
              <View key={food} style={styles.foodChip}><Text style={styles.foodText}>{food}</Text></View>
            ))}
          </View>
        )}

        {/* Друзья пили / отзывы */}
        <View style={styles.sectionHeadBaseline}>
          <Text style={styles.h3}>{friendReviews.length > 0 ? "Друзья пили" : "Отзывы"}</Text>
          {beer.reviews.length > shownReviews.length || (allReviews && beer.reviews.length > 3) ? (
            <Pressable onPress={() => setAllReviews((v) => !v)} hitSlop={8}>
              <Text style={styles.link}>{allReviews ? "Свернуть" : `Все ${beer.reviews.length}`}</Text>
            </Pressable>
          ) : null}
        </View>
        {beer.reviews.length === 0 ? (
          <Text style={styles.empty}>Пока никто не оставил отзыв — будьте первым!</Text>
        ) : (
          <View style={styles.reviewsCard}>
            {shownReviews.map((r, i) => {
              const [avBg, avFg] = avatarColors(r.user.name);
              return (
                <View key={r.id} style={[styles.review, i < shownReviews.length - 1 && styles.reviewDivider]}>
                  <View style={[styles.avatar, { backgroundColor: avBg }]}>
                    <Text style={[styles.avatarText, { color: avFg }]}>{r.user.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.reviewBody}>
                    <View style={styles.reviewTop}>
                      <Text style={styles.reviewName} numberOfLines={1}>{r.user.name}</Text>
                      <Text style={styles.reviewStars}>{stars(r.rating)}</Text>
                    </View>
                    {r.text ? <Text style={styles.reviewText}>{r.text}</Text> : null}
                    {r.tags.length > 0 && <Text style={styles.reviewTags}>{r.tags.join(" · ")}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Куда дальше */}
        <Text style={styles.h3Block}>Куда дальше</Text>
        <View style={styles.lensRow}>
          {LENSES.map((l) => (
            <Pressable key={l.id} onPress={() => setLens(l.id)} style={[styles.lens, lens === l.id && styles.lensOn]}>
              <Text style={[styles.lensText, lens === l.id && styles.lensTextOn]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.nextList}>
          {next.length === 0 ? (
            <Text style={styles.empty}>В каталоге пока нет подходящих — загляните позже.</Text>
          ) : (
            next.map((rec) => {
              const good = rec.matchPercent != null && rec.matchPercent >= 80;
              return (
                <Pressable key={rec.id} onPress={() => navigation.push("BeerDetail", { beerId: rec.id })} style={styles.nextRow}>
                  <View style={[styles.nextThumb, { backgroundColor: beerColor(rec.style) }]}>
                    <BeerArt name={rec.name} imageUrl={rec.imageUrl} size={56} shape="circle" style={styles.nextArt} />
                  </View>
                  <View style={styles.nextInfo}>
                    <Text style={styles.nextName} numberOfLines={1}>{rec.name}</Text>
                    <Text style={styles.nextSub} numberOfLines={1}>{rec.brewery.name} · {rec.style}</Text>
                  </View>
                  {rec.matchPercent != null && (
                    <View style={[styles.nextMatch, { backgroundColor: good ? C.sage : rec.matchPercent >= 70 ? C.peach : "#eee7db" }]}>
                      <Text style={[styles.nextMatchText, { color: good ? "#3d472b" : rec.matchPercent >= 70 ? C.peachInk : C.ink2 }]}>{rec.matchPercent}%</Text>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Плавающая панель действий */}
      <View style={styles.actions}>
        <Pressable onPress={() => setRatingOpen(true)} style={[styles.actionBtn, styles.actionRate]}>
          <PathIcon d={ICON_PATHS.star} color={C.amber} size={18} />
          <Text style={styles.actionText}>{myReview ? "Моя оценка" : "Оценить"}</Text>
        </Pressable>
        <Pressable onPress={addToBar} disabled={barAdded || addingToBar} style={[styles.actionBtn, styles.actionBar, barAdded && { opacity: 0.7 }]}>
          <PathIcon d={barAdded ? ICON_PATHS.check : ICON_PATHS.plus} color={C.card} size={18} strokeWidth={3} />
          <Text style={styles.actionText}>{barAdded ? "В моём баре" : "В мой бар"}</Text>
        </Pressable>
        <Pressable onPress={shareToFriend} style={styles.actionShare} hitSlop={6}>
          <PathIcon d={ICON_PATHS.send} color={C.cream} size={20} strokeWidth={2.4} />
        </Pressable>
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
    </View>
  );
}

const display = fonts.display;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 130 },

  head: { borderBottomLeftRadius: 44, borderBottomRightRadius: 44, overflow: "hidden", paddingBottom: 26 },
  foam: { position: "absolute", left: 0, right: 0, top: 0, backgroundColor: C.card },
  foamBubbles: { position: "absolute", left: -14, right: -14, flexDirection: "row", justifyContent: "space-between" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" },
  pill: { backgroundColor: C.sand, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: C.ink2 },

  titleRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 24, paddingTop: 44, gap: 10 },
  titleCol: { flex: 1, gap: 8, paddingBottom: 6 },
  brewery: { fontFamily: fonts.bodySemiBold, fontSize: 15 },
  name: { fontFamily: display, fontSize: 38, lineHeight: 40 },
  nameLong: { fontSize: 30, lineHeight: 33 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  bottle: { backgroundColor: "transparent" },
  drawnBottle: { width: 96, height: 210, borderRadius: 28, backgroundColor: C.card, shadowColor: "#643312", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.28, shadowRadius: 30, elevation: 6 },
  drawnCap: { position: "absolute", left: 10, right: 10, top: 10, height: 10, borderRadius: 6, backgroundColor: C.sand },
  drawnLabel: { position: "absolute", left: 10, right: 18, top: 70, height: 74, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  drawnLabelText: { fontFamily: display, fontSize: 10.5, lineHeight: 13, textAlign: "center", color: C.ink },

  matchCard: { marginHorizontal: 16, marginTop: 22, backgroundColor: C.ink, borderRadius: 32, paddingVertical: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 16 },
  matchValue: { fontFamily: display, fontSize: 46, color: C.amber },
  matchText: { flex: 1, gap: 3 },
  matchHeadline: { fontFamily: display, fontSize: 19, color: C.cream },
  matchSub: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: "#dcd3c4" },

  kicker: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 10, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: C.muted },
  whyList: { marginHorizontal: 20, gap: 8 },
  whyRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 999, paddingVertical: 8, paddingLeft: 8, paddingRight: 18 },
  whyDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  whyText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20 },

  passport: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 24 },
  passportItem: { flex: 1, aspectRatio: 1, borderRadius: 999, backgroundColor: C.card, alignItems: "center", justifyContent: "center", gap: 2 },
  passportValue: { fontFamily: display, fontSize: 19, color: C.ink },
  passportLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: C.muted },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 12, gap: 8 },
  sectionHeadBaseline: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 12 },
  h3: { fontFamily: display, fontSize: 21, color: C.ink, flexShrink: 1 },
  h3Block: { fontFamily: display, fontSize: 21, color: C.ink, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 12 },
  legend: { flexDirection: "row", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendBeer: { width: 10, height: 10, borderRadius: 3, backgroundColor: C.copper },
  legendYou: { width: 14, height: 4, borderRadius: 9, backgroundColor: C.ink },
  legendText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.muted },

  eqCard: { marginHorizontal: 20, backgroundColor: C.card, borderRadius: 30, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 14 },
  eqRow: { flexDirection: "row", gap: 10, height: 140 },
  eqTrack: { flex: 1, borderRadius: 18, backgroundColor: C.sand, overflow: "hidden", justifyContent: "flex-end" },
  eqFill: { backgroundColor: C.copper, borderRadius: 18 },
  eqYou: { position: "absolute", left: 6, right: 6, height: 5, borderRadius: 9, backgroundColor: C.ink, borderWidth: 2, borderColor: C.card, marginBottom: -4 },
  eqLabels: { flexDirection: "row", gap: 10, marginTop: 8 },
  eqLabel: { flex: 1, textAlign: "center", fontFamily: fonts.bodySemiBold, fontSize: 11, color: C.ink2 },
  note: { paddingHorizontal: 24, paddingTop: 10, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: C.muted },

  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20 },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.sand, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  tagChipText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.ink2 },
  tagCount: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.copperDark },
  description: { paddingHorizontal: 24, paddingTop: 24, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: C.ink2 },

  serveRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },
  serveCard: { flex: 1, borderRadius: 26, paddingVertical: 14, paddingHorizontal: 14, gap: 10 },
  serveValue: { fontFamily: display, fontSize: 18, lineHeight: 21 },
  serveLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, marginTop: 3 },
  foodChip: { backgroundColor: C.sand, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  foodText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.ink2 },

  link: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.copperDark },
  empty: { paddingHorizontal: 24, fontFamily: fonts.body, fontSize: 14, color: C.muted },
  reviewsCard: { marginHorizontal: 20, backgroundColor: C.card, borderRadius: 30, paddingVertical: 8, paddingHorizontal: 16 },
  review: { flexDirection: "row", gap: 12, paddingVertical: 12 },
  reviewDivider: { borderBottomWidth: 1, borderBottomColor: "#eee7db" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: display, fontSize: 16 },
  reviewBody: { flex: 1, minWidth: 0, gap: 3 },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  reviewName: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: C.ink },
  reviewStars: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#b2622d", letterSpacing: 1 },
  reviewText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: C.ink2 },
  reviewTags: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.muted },

  lensRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20 },
  lens: { borderRadius: 999, backgroundColor: C.sand, paddingVertical: 9, paddingHorizontal: 16 },
  lensOn: { backgroundColor: C.ink },
  lensText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.ink2 },
  lensTextOn: { fontFamily: fonts.bodyBold, color: C.cream },
  nextList: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.card, borderRadius: 24, paddingVertical: 10, paddingLeft: 10, paddingRight: 14 },
  nextThumb: { width: 56, height: 56, borderRadius: 28, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  nextArt: { backgroundColor: "transparent" },
  nextInfo: { flex: 1, minWidth: 0 },
  nextName: { fontFamily: fonts.bodyBold, fontSize: 16, color: C.ink },
  nextSub: { fontFamily: fonts.body, fontSize: 14, color: C.muted },
  nextMatch: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  nextMatchText: { fontFamily: fonts.bodyBold, fontSize: 14 },

  actions: { position: "absolute", left: 12, right: 12, bottom: 14, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.ink, borderRadius: 999, padding: 8, shadowColor: "#2e2b25", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.35, shadowRadius: 30, elevation: 8 },
  actionBtn: { height: 50, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionRate: { flex: 1, backgroundColor: C.ink2 },
  actionBar: { flex: 1.3, backgroundColor: C.copper },
  actionText: { fontFamily: display, fontSize: 16, color: C.card },
  actionShare: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.ink2, alignItems: "center", justifyContent: "center" },
});
