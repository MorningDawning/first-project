import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { Icon } from "../../components/icons/Icon";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { chatsApi, friendsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { plural } from "../../lib/time";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { FriendItem } from "../../types";

type Props = NativeStackScreenProps<FeedStackParamList, "NewGroup">;

/** Два режима: создать новую группу или добавить друзей в существующую (addTo). */
export function NewGroupScreen({ route, navigation }: Props) {
  const addTo = route.params?.addTo;
  const exclude = route.params?.exclude ?? [];
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    friendsApi
      .list()
      .then((list) => setFriends(list.filter((f) => !exclude.includes(f.id))))
      // eslint-disable-next-line react-hooks/exhaustive-deps
      .catch((e) => setError(apiErrorMessage(e, "Не удалось загрузить друзей")))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (selected.length === 0 || saving) return;
    setSaving(true);
    try {
      if (addTo) {
        await chatsApi.addMembers(addTo, selected);
        navigation.goBack();
      } else {
        const chatId = await chatsApi.createGroup(title.trim(), selected);
        navigation.replace("Chat", { chatId });
      }
    } catch (e) {
      Alert.alert("Не получилось", apiErrorMessage(e));
      setSaving(false);
    }
  }

  const q = query.trim().toLowerCase();
  const visible = q ? friends.filter((f) => f.name.toLowerCase().includes(q)) : friends;
  const chosen = friends.filter((f) => selected.includes(f.id));

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{addTo ? "Добавить в группу" : "Новая группа"}</Text>
      </View>

      {!addTo && (
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Название группы (необязательно)"
          placeholderTextColor={colors.textMuted}
          style={styles.titleInput}
          maxLength={60}
        />
      )}

      <View style={styles.search}>
        <Icon name="search" color={colors.textMuted} size={18} strokeWidth={2.75} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по друзьям"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      {chosen.length > 0 && (
        <FlatList
          horizontal
          data={chosen}
          keyExtractor={(f) => f.id}
          showsHorizontalScrollIndicator={false}
          style={styles.chosenRow}
          contentContainerStyle={styles.chosen}
          renderItem={({ item }) => (
            <Pressable onPress={() => toggle(item.id)} style={styles.chip}>
              <Avatar user={item} size={24} />
              <Text style={styles.chipText}>{item.name.split(" ")[0]}</Text>
              <Icon name="close" color={colors.textMuted} size={12} strokeWidth={3} />
            </Pressable>
          )}
        />
      )}

      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={error} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyView emoji="🤝" message={q ? "Никого не нашли" : addTo ? "Все ваши друзья уже в группе" : "Пока нет друзей, которых можно добавить"} />
          }
          renderItem={({ item }) => {
            const on = selected.includes(item.id);
            return (
              <Pressable onPress={() => toggle(item.id)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
                <Avatar user={item} size={44} />
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on && <Icon name="check" color={colors.background} size={14} strokeWidth={3.5} />}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Pressable
          onPress={submit}
          disabled={selected.length === 0 || saving}
          style={[styles.submit, (selected.length === 0 || saving) && { opacity: 0.45 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.submitText}>
              {selected.length === 0
                ? addTo ? "Выбери, кого добавить" : "Выбери участников"
                : addTo
                  ? `Добавить (${selected.length})`
                  : `Создать группу · ${selected.length} ${plural(selected.length, "друг", "друга", "друзей")}`}
            </Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingTop: 6 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  titleInput: { marginHorizontal: spacing.lg, marginTop: 14, height: 50, borderRadius: radius.pill, backgroundColor: colors.card, paddingHorizontal: 18, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  search: { marginHorizontal: spacing.lg, marginTop: 10, height: 46, borderRadius: radius.pill, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  chosenRow: { flexGrow: 0, marginTop: 10 },
  chosen: { paddingHorizontal: spacing.lg, gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.border, borderRadius: radius.pill, paddingVertical: 5, paddingLeft: 5, paddingRight: 10 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  list: { padding: spacing.lg, gap: 8, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 22, padding: 10 },
  name: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "#B9AE9B", alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.background },
  submit: { height: 54, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  submitText: { fontFamily: fonts.display, fontSize: 16, color: colors.background },
});
