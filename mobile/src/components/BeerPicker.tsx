import React, { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BeerArt } from "./BeerArt";
import { Icon } from "./icons/Icon";
import { barApi, beersApi } from "../api/beervia";
import { colors, fonts, radius, spacing } from "../theme/colors";

export type PickedBeer = {
  id: string;
  name: string;
  style: string;
  imageUrl: string | null;
  brewery: { name: string };
};

type Props = { visible: boolean; onClose: () => void; onPick: (beer: PickedBeer) => void };

export function BeerPicker({ visible, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [bar, setBar] = useState<PickedBeer[]>([]);
  const [results, setResults] = useState<PickedBeer[]>([]);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    barApi
      .list()
      .then((entries) => {
        const seen = new Set<string>();
        setBar(entries.map((e) => e.beer).filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true))));
      })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    const q = query.trim();
    if (!visible || !q) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      beersApi.search({ q }).then(setResults).catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, visible]);

  const searching = query.trim().length > 0;
  const list = searching ? results : bar;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Выбери пиво</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Icon name="close" color={colors.text} size={18} strokeWidth={2.75} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Icon name="search" color={colors.textMuted} size={18} strokeWidth={2.75} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Название, пивоварня, стиль"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.section}>{searching ? "Результаты" : "Из моего бара"}</Text>
        <FlatList
          data={list}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searching ? "Ничего не нашли" : "В баре пока пусто — найди пиво по названию"}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
              <BeerArt name={item.name} imageUrl={item.imageUrl} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>{item.brewery.name} · {item.style}</Text>
              </View>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  search: {
    marginHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  section: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: "center", paddingTop: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 22, padding: 10 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
});
