import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { FriendActionButton } from "../../components/FriendActionButton";
import { Icon } from "../../components/icons/Icon";
import { EmptyView } from "../../components/StateViews";
import { profilesApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { plural } from "../../lib/time";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { FriendStatus, PersonSearchResult } from "../../types";

type Props = NativeStackScreenProps<FeedStackParamList, "PeopleSearch">;

const MIN_LENGTH = 2;

export function PeopleSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const term = query.trim();

  // Ищем через 300 мс после последнего символа; ответ на устаревший запрос отбрасываем.
  useEffect(() => {
    if (term.replace(/^@+/, "").length < MIN_LENGTH) {
      requestId.current++;
      setResults([]);
      setSearched("");
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const found = await profilesApi.search(term);
        if (id !== requestId.current) return;
        setResults(found);
        setSearched(term);
        setError(null);
      } catch (e) {
        if (id === requestId.current) setError(apiErrorMessage(e, "Не удалось выполнить поиск"));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  function onFriendChanged(userId: string, status: FriendStatus) {
    setResults((list) => list.map((r) => (r.user.id === userId ? { ...r, friendStatus: status } : r)));
  }

  const tooShort = term.replace(/^@+/, "").length < MIN_LENGTH;

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Поиск людей</Text>
      </View>
      <View style={styles.search}>
        <Icon name="search" color={colors.textMuted} size={18} strokeWidth={2.75} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Имя или @ник"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={40}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Icon name="close" color={colors.textMuted} size={16} strokeWidth={2.75} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={tooShort ? [] : results}
        keyExtractor={(r) => r.user.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        ListEmptyComponent={
          tooShort ? (
            <EmptyView emoji="🔎" message={"Введите имя или @ник друга, чтобы найти его.\nНапример: Дима или @dima"} />
          ) : error ? (
            <EmptyView emoji="⚠️" message={error} />
          ) : loading || searched !== term ? null : (
            <EmptyView emoji="🤷" message={`Никого не нашли по запросу «${searched}»`} />
          )
        }
        renderItem={({ item }) => {
          const parts = [
            item.mutualFriends > 0
              ? `${item.mutualFriends} ${plural(item.mutualFriends, "общий друг", "общих друга", "общих друзей")}`
              : null,
            item.match != null ? `вкус на ${item.match}%` : null,
          ].filter(Boolean);
          return (
            <Pressable
              onPress={() => navigation.navigate("UserProfile", { userId: item.user.id })}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <Avatar user={item.user} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.user.name}</Text>
                <Text style={styles.handle} numberOfLines={1}>
                  {[item.user.username ? `@${item.user.username}` : null, item.city].filter(Boolean).join(" · ")}
                </Text>
                {parts.length > 0 && <Text style={styles.meta} numberOfLines={1}>{parts.join(" · ")}</Text>}
              </View>
              <FriendActionButton
                userId={item.user.id}
                status={item.friendStatus}
                variant="small"
                onChanged={(status) => onFriendChanged(item.user.id, status)}
              />
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingTop: 6 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  search: { marginHorizontal: spacing.lg, marginTop: 14, height: 46, borderRadius: radius.pill, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  list: { padding: spacing.lg, gap: 8, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 22, padding: 10 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  handle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.success, marginTop: 1 },
});
