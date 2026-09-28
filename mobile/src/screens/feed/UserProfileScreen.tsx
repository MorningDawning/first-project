import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { BeerArt } from "../../components/BeerArt";
import { FriendActionButton } from "../../components/FriendActionButton";
import { MatchRing } from "../../components/MatchRing";
import { PostCard } from "../../components/PostCard";
import { Icon } from "../../components/icons/Icon";
import { ErrorView, LoadingView } from "../../components/StateViews";
import { friendsApi, postsApi, profilesApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { plural } from "../../lib/time";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { FeedPost, FriendStatus, PublicProfile, UserBarItem } from "../../types";

type Props = NativeStackScreenProps<FeedStackParamList, "UserProfile">;
type Tab = "bar" | "posts";

function tasteHeadline(percent: number): string {
  if (percent >= 85) return "Вкусы почти совпадают";
  if (percent >= 70) return "Ваши вкусы похожи";
  if (percent >= 50) return "Есть общее";
  return "Вкусы заметно разные";
}

export function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [bar, setBar] = useState<UserBarItem[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [tab, setTab] = useState<Tab>("bar");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, b, ps] = await Promise.all([profilesApi.get(userId), profilesApi.bar(userId), profilesApi.posts(userId)]);
      setProfile(p);
      setBar(b);
      setPosts(ps);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось открыть профиль"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function onRelationChanged(status: FriendStatus) {
    setProfile((p) => (p ? { ...p, relation: { ...p.relation, status } } : p));
    load();
  }

  async function toggleLike(post: FeedPost) {
    const liked = !post.likedByMe;
    const patch = (next: Partial<FeedPost>) => setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, ...next } : p)));
    patch({ likedByMe: liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    try {
      patch(liked ? await postsApi.like(post.id) : await postsApi.unlike(post.id));
    } catch {
      patch({ likedByMe: post.likedByMe, likeCount: post.likeCount });
    }
  }

  function menu() {
    if (!profile) return;
    const isFriend = profile.relation.status === "friends";
    Alert.alert(profile.name, undefined, [
      {
        text: "Пожаловаться",
        onPress: () =>
          profilesApi
            .report(profile.id)
            .then(() => Alert.alert("Спасибо", "Мы посмотрим жалобу."))
            .catch((e) => Alert.alert("Не получилось", apiErrorMessage(e))),
      },
      ...(isFriend
        ? [
            {
              text: "Убрать из друзей",
              style: "destructive" as const,
              onPress: () =>
                friendsApi
                  .remove(profile.id)
                  .then(() => onRelationChanged("none"))
                  .catch((e) => Alert.alert("Не получилось", apiErrorMessage(e))),
            },
          ]
        : []),
      { text: "Отмена", style: "cancel" as const },
    ]);
  }

  if (loading) return <LoadingView label="Открываем профиль…" />;
  if (error || !profile) return <ErrorView message={error ?? "Профиль не найден"} onRetry={load} />;

  const status = profile.relation.status;
  const isSelf = status === "self";
  const sub = [
    profile.username ? `@${profile.username}` : null,
    profile.city,
    profile.mutualFriends > 0
      ? `${profile.mutualFriends} ${plural(profile.mutualFriends, "общий друг", "общих друга", "общих друзей")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const { stats } = profile;

  return (
    <Screen>
      <View style={styles.blob} pointerEvents="none" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <BackButton onPress={() => navigation.goBack()} />
          {!isSelf && (
            <Pressable onPress={menu} hitSlop={8} style={styles.menuBtn}>
              <Icon name="dots" color={colors.text} size={20} />
            </Pressable>
          )}
        </View>

        <View style={styles.head}>
          <View style={styles.avatarWrap}>
            <Avatar user={profile} size={92} />
          </View>
          <View>
            <Text style={styles.name}>{profile.name}</Text>
            {sub ? <Text style={styles.sub}>{sub}</Text> : null}
          </View>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.stats}>
            <Text style={styles.stat}><Text style={styles.statNum}>{stats.friendCount}</Text> {plural(stats.friendCount, "друг", "друга", "друзей")}</Text>
            <Text style={styles.stat}><Text style={styles.statNum}>{stats.scanCount}</Text> {plural(stats.scanCount, "скан", "скана", "сканов")}</Text>
            <Text style={styles.stat}><Text style={styles.statNum}>{stats.reviewCount}</Text> {plural(stats.reviewCount, "отзыв", "отзыва", "отзывов")}</Text>
          </View>

          {!isSelf && (
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <FriendActionButton userId={profile.id} status={status} variant="large" onChanged={onRelationChanged} />
              </View>
              {status === "friends" ? (
                <Pressable
                  onPress={() => navigation.navigate("Chat", { userId: profile.id })}
                  style={[styles.writeBtn, styles.writeOpen]}
                >
                  <Icon name="send" color={colors.text} size={16} />
                  <Text style={[styles.writeText, { color: colors.text }]}>Написать</Text>
                </Pressable>
              ) : (
                <View style={[styles.writeBtn, styles.writeLocked]}>
                  <Icon name="lock" color="#82796A" size={16} />
                  <Text style={styles.writeText}>Написать</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {profile.taste && (
          <View style={styles.tasteCard}>
            <MatchRing percent={profile.taste.percent} size={58} strokeWidth={5} trackColor="#CCDBB2">
              <Text style={styles.tastePercent}>{profile.taste.percent}%</Text>
            </MatchRing>
            <View style={{ flex: 1 }}>
              <Text style={styles.tasteTitle}>{tasteHeadline(profile.taste.percent)}</Text>
              <Text style={styles.tasteNote}>{profile.taste.note}</Text>
            </View>
          </View>
        )}

        <View style={styles.tabs}>
          {([["bar", `Бар · ${bar.length}`], ["posts", `Посты · ${stats.postCount}`]] as const).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "bar" ? (
          bar.length === 0 ? (
            <Text style={styles.empty}>В баре пока пусто</Text>
          ) : (
            <View style={styles.grid}>
              {bar.map((item) => (
                <Pressable
                  key={item.beer.id}
                  onPress={() => navigation.navigate("BeerDetail", { beerId: item.beer.id })}
                  style={styles.gridItem}
                >
                  <BeerArt name={item.beer.name} imageUrl={item.beer.imageUrl} size={52} />
                  <Text style={styles.gridName} numberOfLines={1}>{item.beer.name}</Text>
                  {item.rating != null && <Text style={styles.gridRate}>★ {item.rating.toFixed(1)}</Text>}
                </Pressable>
              ))}
            </View>
          )
        ) : posts.length === 0 ? (
          <Text style={styles.empty}>Постов пока нет</Text>
        ) : (
          <View style={styles.postList}>
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onPress={() => navigation.navigate("PostDetail", { postId: p.id })}
                onLike={() => toggleLike(p)}
                onOpenUser={() => {}}
                onOpenBeer={(beerId) => navigation.navigate("BeerDetail", { beerId })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute", left: -80, top: -150, width: 360, height: 360, borderRadius: 180, backgroundColor: "#CCDBB2" },
  content: { paddingBottom: spacing.xl * 2 },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 6 },
  menuBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },

  head: { paddingHorizontal: spacing.lg, paddingTop: 8, gap: 12 },
  avatarWrap: { alignSelf: "flex-start", borderRadius: 51, borderWidth: 5, borderColor: colors.background },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 31, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 4 },
  bio: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  stats: { flexDirection: "row", gap: 18 },
  stat: { fontFamily: fonts.body, fontSize: 14, color: "#474238" },
  statNum: { fontFamily: fonts.bodyBold, color: colors.text },
  actions: { flexDirection: "row", gap: 8 },
  writeBtn: { height: 50, paddingHorizontal: 20, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  writeLocked: { borderWidth: 2, borderColor: colors.border },
  writeOpen: { backgroundColor: colors.card },
  writeText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#82796A" },

  tasteCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: "#E1EECC", borderRadius: 26, padding: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  tastePercent: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#272E1B" },
  tasteTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#272E1B" },
  tasteNote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: "#3D472B", marginTop: 2 },

  tabs: { flexDirection: "row", gap: 20, marginHorizontal: spacing.lg, marginTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingBottom: 10, paddingHorizontal: 2, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.textMuted },
  tabTextActive: { color: colors.text },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: spacing.lg, paddingTop: 12 },
  gridItem: { width: "31.5%", backgroundColor: colors.card, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", gap: 6 },
  gridName: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text, maxWidth: "100%" },
  gridRate: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#B2622D" },
  postList: { paddingHorizontal: spacing.lg, paddingTop: 12, gap: 12 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: "center", padding: spacing.xl },
});
