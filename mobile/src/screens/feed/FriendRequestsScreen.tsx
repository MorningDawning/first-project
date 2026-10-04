import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { friendsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { plural } from "../../lib/time";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { FriendRequest } from "../../types";

type Nav = NativeStackNavigationProp<FeedStackParamList, "FriendRequests">;

export function FriendRequestsScreen() {
  const navigation = useNavigation<Nav>();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRequests(await friendsApi.requests());
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить заявки"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function answer(request: FriendRequest, accept: boolean) {
    try {
      await (accept ? friendsApi.accept(request.requestId) : friendsApi.decline(request.requestId));
      setRequests((list) => list.filter((r) => r.requestId !== request.requestId));
    } catch (e) {
      Alert.alert("Не получилось", apiErrorMessage(e));
    }
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Заявки в друзья</Text>
      </View>

      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.requestId}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<EmptyView emoji="🤝" message="Новых заявок нет" />}
          renderItem={({ item }) => {
            const mutual = item.mutualFriends;
            const meta = [
              item.match != null ? `Вкус ${item.match}%` : null,
              mutual > 0 ? `${mutual} ${plural(mutual, "общий друг", "общих друга", "общих друзей")}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <View style={styles.row}>
                <Pressable
                  onPress={() => navigation.navigate("UserProfile", { userId: item.user.id })}
                  style={styles.person}
                >
                  <Avatar user={item.user} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.user.name}</Text>
                    {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
                  </View>
                </Pressable>
                <Pressable onPress={() => answer(item, false)} hitSlop={6} style={[styles.btn, styles.decline]}>
                  <Text style={styles.declineText}>Отклонить</Text>
                </Pressable>
                <Pressable onPress={() => answer(item, true)} hitSlop={6} style={[styles.btn, styles.accept]}>
                  <Text style={styles.acceptText}>Принять</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: 10 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  list: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  row: { backgroundColor: colors.card, borderRadius: 24, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  btn: { height: 34, paddingHorizontal: 12, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  accept: { backgroundColor: colors.text },
  acceptText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.background },
  decline: { backgroundColor: colors.border },
  declineText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#474238" },
});
