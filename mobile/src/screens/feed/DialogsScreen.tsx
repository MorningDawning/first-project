import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { GroupAvatar } from "../../components/GroupAvatar";
import { Icon } from "../../components/icons/Icon";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { chatsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { dialogTime } from "../../lib/time";
import { useRealtimeConnected, useRealtimeEvents } from "../../lib/realtime";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { ChatSummary } from "../../types";

type Nav = NativeStackNavigationProp<FeedStackParamList, "Dialogs">;

const TYPING_TTL = 5_000;

export function DialogsScreen() {
  const navigation = useNavigation<Nav>();
  const connected = useRealtimeConnected();
  const [items, setItems] = useState<ChatSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // chatId -> кто сейчас печатает (имя) и до какого момента показывать
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});

  const load = useCallback(async () => {
    try {
      setItems(await chatsApi.list());
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить сообщения"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      return () => setFocused(false);
    }, [load])
  );

  useRealtimeEvents((event) => {
    if (event.type === "typing") {
      setTyping((prev) => ({ ...prev, [event.chatId]: { name: event.name, until: Date.now() + TYPING_TTL } }));
    } else {
      if (event.type === "message") {
        setTyping((prev) => {
          if (!(event.chatId in prev)) return prev;
          const { [event.chatId]: _gone, ...rest } = prev;
          return rest;
        });
      }
      load();
    }
  });

  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(load, connected ? 30_000 : 10_000);
    return () => clearInterval(timer);
  }, [focused, connected, load]);

  const anyTyping = Object.keys(typing).length > 0;
  useEffect(() => {
    if (!anyTyping) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1_000);
    return () => clearInterval(timer);
  }, [anyTyping]);

  const q = query.trim().toLowerCase();
  const visible = q ? items.filter((c) => c.title.toLowerCase().includes(q)) : items;

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Сообщения</Text>
        <Pressable onPress={() => navigation.navigate("NewMessage")} style={styles.iconBtn} hitSlop={8}>
          <Icon name="pencil" color={colors.text} size={20} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Icon name="search" color={colors.textMuted} size={18} strokeWidth={2.75} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по чатам"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <LoadingView />
      ) : error && items.length === 0 ? (
        <ErrorView message={error} onRetry={load} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={visible.length > 0 ? <Text style={styles.section}>Диалоги</Text> : null}
          ListEmptyComponent={
            <EmptyView emoji="💬" message={q ? "Ничего не нашли" : "Пока нет диалогов. Нажми на карандаш, чтобы написать другу или создать группу"} />
          }
          renderItem={({ item }) => {
            const unread = item.unread > 0;
            const last = item.lastMessage;
            const typingNow = typing[item.id];
            const preview = last
              ? last.text ?? (last.beerName ? `Пиво: ${last.beerName}` : last.hasPhoto ? "Фото" : "")
              : "";
            const prefix = last?.fromMe ? "Вы: " : last?.senderName ? `${last.senderName}: ` : "";
            const typingText = typingNow ? (item.type === "group" ? `${typingNow.name.split(" ")[0]} печатает…` : "печатает…") : null;
            return (
              <Pressable
                onPress={() => navigation.navigate("Chat", { chatId: item.id })}
                style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && { opacity: 0.85 }]}
              >
                <View>
                  {item.type === "group" ? <GroupAvatar id={item.id} size={52} /> : item.peer && <Avatar user={item.peer} size={52} />}
                  {item.type === "direct" && item.peer?.online && <View style={styles.onlineDot} />}
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
                    {last && <Text style={styles.time}>{dialogTime(last.createdAt)}</Text>}
                  </View>
                  <View style={styles.rowTop}>
                    {typingText ? (
                      <Text style={[styles.preview, { color: colors.success, fontFamily: fonts.bodySemiBold }]} numberOfLines={1}>
                        {typingText}
                      </Text>
                    ) : (
                      <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                        {last?.kind === "system" ? "" : prefix}
                        {preview}
                      </Text>
                    )}
                    {unread && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingTop: 6 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 26, color: colors.text },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  search: {
    marginHorizontal: spacing.lg,
    marginTop: 14,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  list: { paddingHorizontal: 12, paddingBottom: spacing.xl, flexGrow: 1 },
  section: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted, paddingHorizontal: 12, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, paddingHorizontal: 12, borderRadius: 22 },
  rowUnread: { backgroundColor: colors.card },
  onlineDot: { position: "absolute", right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: "#7A8A5E", borderWidth: 3, borderColor: colors.background },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  time: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  preview: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  previewUnread: { fontFamily: fonts.bodySemiBold, color: colors.text },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.background },
});
