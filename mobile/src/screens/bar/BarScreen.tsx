import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BeerCard } from "../../components/BeerCard";
import { Button } from "../../components/Button";
import { ErrorView, LoadingView } from "../../components/StateViews";
import { barApi, wishlistApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { BarStackParamList, MainTabParamList } from "../../navigation/types";
import { BarEntry, BeerSummary } from "../../types";

type Nav = NativeStackNavigationProp<BarStackParamList, "BarHome">;
type Tab = "all" | "favorites" | "wishlist";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function starsText(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export function BarScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>("all");
  const [entries, setEntries] = useState<BarEntry[]>([]);
  const [wishlist, setWishlist] = useState<BeerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bar, wish] = await Promise.all([barApi.list(), wishlistApi.list()]);
      setEntries(bar);
      setWishlist(wish);
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

  function openCamera() {
    navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate("CameraTab");
  }

  const favorites = entries.filter((e) => (e.rating ?? 0) >= 4);
  const visible = tab === "favorites" ? favorites : entries;

  return (
    <Screen>
      <Text style={styles.title}>Мой бар</Text>
      <Text style={styles.subtitle}>Всё, что ты уже отсканировал</Text>

      <View style={styles.segmented}>
        <SegmentButton label={`Все · ${entries.length}`} active={tab === "all"} onPress={() => setTab("all")} />
        <SegmentButton label="Любимые" active={tab === "favorites"} onPress={() => setTab("favorites")} />
        <SegmentButton label="Хочу" active={tab === "wishlist"} onPress={() => setTab("wishlist")} />
      </View>

      {loading ? (
        <LoadingView label="Загружаем бар…" />
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : tab === "wishlist" ? (
        wishlist.length === 0 ? (
          <EmptyBar
            message="Пока нечего пробовать — добавляй пиво из библиотеки, нажимая на сердечко"
            onScan={openCamera}
          />
        ) : (
          <FlatList
            data={wishlist}
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
        )
      ) : visible.length === 0 ? (
        <EmptyBar
          message={
            tab === "favorites"
              ? "Пока нет любимых — оцени пиво на 4-5 звёзд, и оно появится здесь"
              : "Полки пока пустые — отсканируй первое пиво, и оно появится здесь вместе с твоей оценкой"
          }
          onScan={openCamera}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(e) => e.scanId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BeerCard
              name={item.beer.name}
              style={item.beer.style}
              breweryName={item.beer.brewery.name}
              imageUrl={item.beer.imageUrl}
              subtitle={item.rating ? `${starsText(item.rating)} · ${formatDate(item.scannedAt)}` : formatDate(item.scannedAt)}
              onPress={() => navigation.navigate("BeerDetail", { beerId: item.beer.id })}
            />
          )}
        />
      )}
    </Screen>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EmptyBar({ message, onScan }: { message: string; onScan: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🍺</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      <Button title="Сканировать" onPress={onScan} style={styles.emptyButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },

  segmented: { flexDirection: "row", marginHorizontal: spacing.lg, backgroundColor: colors.border, borderRadius: radius.lg, padding: 4, marginBottom: spacing.sm },
  segment: { flex: 1, paddingVertical: spacing.sm + 2, borderRadius: radius.md, alignItems: "center" },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted },
  segmentTextActive: { color: colors.text },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyMessage: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, textAlign: "center" },
  emptyButton: { marginTop: spacing.sm, paddingHorizontal: spacing.xl },
});
