import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { Icon } from "../../components/icons/Icon";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { chatsApi, friendsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { FriendItem } from "../../types";

type Nav = NativeStackNavigationProp<FeedStackParamList, "NewMessage">;

export function NewMessageScreen() {
  const navigation = useNavigation<Nav>();
  const shareBeerId = useRoute<RouteProp<FeedStackParamList, "NewMessage">>().params?.shareBeerId; // пришли отправить пиво
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    friendsApi
      .list()
      .then(setFriends)
      .catch((e) => setError(apiErrorMessage(e, "Не удалось загрузить друзей")))
      .finally(() => setLoading(false));
  }, []);

  async function open(friend: FriendItem) {
    try {
      const chatId = await chatsApi.openDirect(friend.id);
      if (shareBeerId) await chatsApi.send(chatId, { beerId: shareBeerId });
      navigation.replace("Chat", { chatId });
    } catch (e) {
      Alert.alert("Не получилось", apiErrorMessage(e));
    }
  }

  const q = query.trim().toLowerCase();
  const visible = q ? friends.filter((f) => f.name.toLowerCase().includes(q)) : friends;

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{shareBeerId ? "Кому отправить пиво" : "Кому написать"}</Text>
      </View>
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
          ListHeaderComponent={
            !q && !shareBeerId ? (
              <Pressable onPress={() => navigation.navigate("NewGroup")} style={({ pressed }) => [styles.row, styles.groupRow, pressed && { opacity: 0.85 }]}>
                <View style={styles.groupIcon}>
                  <Icon name="users" color={colors.background} size={22} />
                </View>
                <Text style={styles.groupText}>Новая группа</Text>
                <Icon name="chevronRight" color={colors.textMuted} size={18} strokeWidth={2.75} />
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <EmptyView emoji="🤝" message={q ? "Никого не нашли" : "Пока нет друзей. Добавь кого-нибудь во вкладке «Для тебя»"} />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
              <View>
                <Avatar user={item} size={48} />
                {item.online && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.match != null && <Text style={styles.meta}>вкус совпадает на {item.match}%</Text>}
              </View>
            </Pressable>
          )}
        />
      )}
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
  groupRow: { marginBottom: 4 },
  groupIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  groupText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  onlineDot: { position: "absolute", right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: "#7A8A5E", borderWidth: 3, borderColor: colors.card },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.success },
});
