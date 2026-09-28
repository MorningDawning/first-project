import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { FriendActionButton } from "../../components/FriendActionButton";
import { MatchRing } from "../../components/MatchRing";
import { PostCard } from "../../components/PostCard";
import { Icon } from "../../components/icons/Icon";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { feedApi, friendsApi, messagesApi, postsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { plural } from "../../lib/time";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { FeedPost, FriendRequest, FriendStatus, SimilarPerson } from "../../types";

type Nav = NativeStackNavigationProp<FeedStackParamList, "FeedHome">;
type Tab = "friends" | "foryou";

export function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>("friends");
  const [friendsPosts, setFriendsPosts] = useState<FeedPost[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [forYouPosts, setForYouPosts] = useState<FeedPost[]>([]);
  const [people, setPeople] = useState<SimilarPerson[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [friends, forYou, similar, incoming, unreadCount] = await Promise.all([
        feedApi.list("friends"),
        feedApi.list("foryou"),
        feedApi.people(),
        friendsApi.requests(),
        messagesApi.unreadCount(),
      ]);
      setUnread(unreadCount);
      setFriendsPosts(friends.posts);
      setNextBefore(friends.nextBefore);
      setForYouPosts(forYou.posts);
      setPeople(similar);
      setRequests(incoming);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить ленту"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function loadMore() {
    if (tab !== "friends" || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await feedApi.list("friends", nextBefore);
      setFriendsPosts((prev) => [...prev, ...page.posts]);
      setNextBefore(page.nextBefore);
    } catch {
      // следующая попытка — при новом скролле
    } finally {
      setLoadingMore(false);
    }
  }

  function patchPost(id: string, patch: Partial<FeedPost>) {
    const apply = (list: FeedPost[]) => list.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setFriendsPosts(apply);
    setForYouPosts(apply);
  }

  async function toggleLike(post: FeedPost) {
    const liked = !post.likedByMe;
    patchPost(post.id, { likedByMe: liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    try {
      patchPost(post.id, liked ? await postsApi.like(post.id) : await postsApi.unlike(post.id));
    } catch {
      patchPost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    }
  }

  function onFriendChanged(userId: string, status: FriendStatus) {
    setForYouPosts((list) =>
      list.map((p) => (p.user.id === userId && p.author ? { ...p, author: { ...p.author, friendStatus: status } } : p))
    );
    setPeople((list) => list.map((x) => (x.user.id === userId ? { ...x, friendStatus: status } : x)));
  }

  const posts = tab === "friends" ? friendsPosts : forYouPosts;

  const requestsBanner =
    requests.length > 0 ? (
      <Pressable onPress={() => navigation.navigate("FriendRequests")} style={styles.banner}>
        <View style={styles.bannerAvatars}>
          {requests.slice(0, 2).map((r, i) => (
            <View key={r.requestId} style={[styles.bannerAvatar, i > 0 && { marginLeft: -10 }]}>
              <Avatar user={r.user} size={34} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>
            {requests.length} {plural(requests.length, "заявка", "заявки", "заявок")} в друзья
          </Text>
          <Text style={styles.bannerSub} numberOfLines={1}>
            {requests
              .slice(0, 2)
              .map((r) => r.user.name.split(" ")[0])
              .join(" и ")}{" "}
            {requests.length === 1 ? "хочет" : "хотят"} дружить
          </Text>
        </View>
        <Icon name="chevronRight" color="#3D472B" size={18} strokeWidth={2.75} />
      </Pressable>
    ) : null;

  const peopleRow =
    people.length > 0 ? (
      <View>
        <Text style={styles.sectionTitle}>Похожий вкус</Text>
        <FlatList
          horizontal
          data={people}
          keyExtractor={(x) => x.user.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.peopleList}
          style={styles.peopleRow}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate("UserProfile", { userId: item.user.id })}
              style={styles.personCard}
            >
              <MatchRing percent={item.match} size={64} strokeWidth={4} trackColor={colors.border}>
                <Avatar user={item.user} size={50} />
              </MatchRing>
              <View style={styles.personText}>
                <Text style={styles.personName} numberOfLines={1}>{item.user.name.split(" ")[0]}</Text>
                <Text style={styles.personMatch}>вкус · {item.match}%</Text>
              </View>
              <FriendActionButton
                userId={item.user.id}
                status={item.friendStatus}
                variant="small"
                onChanged={(s) => onFriendChanged(item.user.id, s)}
              />
            </Pressable>
          )}
        />
        {posts.length > 0 && <View style={{ height: spacing.md }} />}
      </View>
    ) : null;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Лента</Text>
        <View style={styles.headerButtons}>
          <Pressable onPress={() => navigation.navigate("Compose")} style={styles.plusBtn} hitSlop={6}>
            <Icon name="plus" color={colors.background} size={22} strokeWidth={2.75} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Dialogs")} style={styles.messagesBtn} hitSlop={6}>
            <Icon name="send" color={colors.text} size={22} />
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.segmented}>
        {([["friends", "Друзья"], ["foryou", "Для тебя"]] as const).map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.segment, tab === key && styles.segmentActive]}>
            <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <LoadingView label="Загружаем ленту…" />
      ) : error && posts.length === 0 ? (
        <ErrorView message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <View>
              {tab === "friends" ? requestsBanner : peopleRow}
            </View>
          }
          ListEmptyComponent={
            tab === "friends" ? (
              <EmptyView emoji="🍻" message="Пока тихо. Добавь друзей во вкладке «Для тебя» или напиши первый пост" />
            ) : people.length === 0 ? (
              <EmptyView emoji="🔍" message="Пока нечего показать — оцени несколько сортов, и мы найдём людей с похожим вкусом" />
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh(); }} tintColor={colors.primary} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => navigation.navigate("PostDetail", { postId: item.id })}
              onLike={() => toggleLike(item)}
              onOpenUser={() => navigation.navigate("UserProfile", { userId: item.user.id })}
              onOpenBeer={(beerId) => navigation.navigate("BeerDetail", { beerId })}
              onFriendChanged={onFriendChanged}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 10 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  headerButtons: { flexDirection: "row", gap: 8 },
  messagesBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  unreadBadge: { position: "absolute", top: -4, right: -4, minWidth: 24, height: 24, paddingHorizontal: 5, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.background },
  unreadText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.background },
  plusBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },

  segmented: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: 14,
    marginBottom: 12,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 4,
  },
  segment: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#474238" },
  segmentTextActive: { fontFamily: fonts.bodyBold, color: colors.text },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

  banner: { backgroundColor: "#E1EECC", borderRadius: 24, padding: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  bannerAvatars: { flexDirection: "row" },
  bannerAvatar: { borderRadius: 20, borderWidth: 3, borderColor: "#E1EECC" },
  bannerTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#272E1B" },
  bannerSub: { fontFamily: fonts.body, fontSize: 13, color: "#3D472B" },

  sectionTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginBottom: 10 },
  peopleRow: { flexGrow: 0, marginHorizontal: -spacing.lg },
  peopleList: { paddingHorizontal: spacing.lg, gap: 10 },
  personCard: { width: 128, backgroundColor: colors.card, borderRadius: 26, paddingTop: 14, paddingHorizontal: 10, paddingBottom: 10, alignItems: "center", gap: 8 },
  personText: { alignItems: "center" },
  personName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  personMatch: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.success },
});
