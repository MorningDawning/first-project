import React, { useCallback, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { FriendActionButton } from "../../components/FriendActionButton";
import { CommentPill, LikePill, PostBeerChip, PostPhotos } from "../../components/PostCard";
import { Icon } from "../../components/icons/Icon";
import { ErrorView, LoadingView } from "../../components/StateViews";
import { useAuth } from "../../context/AuthContext";
import { commentsApi, postsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { plural, timeAgo } from "../../lib/time";
import { useHideTabBar } from "../../navigation/useHideTabBar";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { FeedPost, FriendStatus, PostComment } from "../../types";

type Props = NativeStackScreenProps<FeedStackParamList, "PostDetail">;

export function PostDetailScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const { user: me } = useAuth();
  const insets = useSafeAreaInsets();
  useHideTabBar();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, c] = await Promise.all([postsApi.get(postId), postsApi.comments(postId)]);
      setPost(p);
      setComments(c);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось открыть пост"));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleLike() {
    if (!post) return;
    const liked = !post.likedByMe;
    setPost({ ...post, likedByMe: liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    try {
      const state = liked ? await postsApi.like(post.id) : await postsApi.unlike(post.id);
      setPost((p) => (p ? { ...p, ...state } : p));
    } catch {
      setPost((p) => (p ? { ...p, likedByMe: !liked, likeCount: post.likeCount } : p));
    }
  }

  async function toggleCommentLike(c: PostComment) {
    const liked = !c.likedByMe;
    const patch = (next: Partial<PostComment>) =>
      setComments((list) => list.map((x) => (x.id === c.id ? { ...x, ...next } : x)));
    patch({ likedByMe: liked, likeCount: c.likeCount + (liked ? 1 : -1) });
    try {
      patch(liked ? await commentsApi.like(c.id) : await commentsApi.unlike(c.id));
    } catch {
      patch({ likedByMe: c.likedByMe, likeCount: c.likeCount });
    }
  }

  function confirmDeleteComment(c: PostComment) {
    Alert.alert("Удалить комментарий?", undefined, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await commentsApi.remove(c.id);
            await load();
          } catch (e) {
            Alert.alert("Не получилось", apiErrorMessage(e));
          }
        },
      },
    ]);
  }

  function startReply(c: PostComment) {
    setReplyTo(c);
    // Ответ на ответ привязывается к корневому комментарию, поэтому обращаемся по имени.
    if (c.parentId && !text) setText(`${c.user.name.split(" ")[0]}, `);
  }

  async function send() {
    const body = text.trim();
    if (!body || sending || !post) return;
    setSending(true);
    try {
      await postsApi.addComment(post.id, body, replyTo ? replyTo.parentId ?? replyTo.id : undefined);
      setText("");
      setReplyTo(null);
      await load();
    } catch (e) {
      Alert.alert("Не получилось отправить", apiErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  function postMenu() {
    if (!post) return;
    if (post.canDelete) {
      Alert.alert("Удалить пост?", "Вместе с комментариями. Отзыв о пиве останется.", [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              await postsApi.remove(post.id);
              navigation.goBack();
            } catch (e) {
              Alert.alert("Не получилось", apiErrorMessage(e));
            }
          },
        },
      ]);
      return;
    }
    Alert.alert("Пост", undefined, [
      {
        text: "Пожаловаться",
        onPress: () => postsApi.report(post.id).then(() => Alert.alert("Спасибо", "Мы посмотрим жалобу.")).catch(() => {}),
      },
      { text: "Отмена", style: "cancel" },
    ]);
  }

  function onAuthorChanged(status: FriendStatus) {
    setPost((p) => (p && p.author ? { ...p, author: { ...p.author, friendStatus: status } } : p));
  }

  if (loading) return <LoadingView label="Открываем пост…" />;
  if (error || !post) return <ErrorView message={error ?? "Пост не найден"} onRetry={load} />;

  const author = post.author;
  const mutual = author?.mutualFriends ?? 0;
  const sub = [
    timeAgo(post.createdAt),
    mutual > 0 ? `${mutual} ${plural(mutual, "общий друг", "общих друга", "общих друзей")}` : null,
    post.place,
  ]
    .filter(Boolean)
    .join(" · ");

  const header = (
    <View>
      <View style={styles.postBlock}>
        <View style={styles.authorRow}>
          <Pressable onPress={() => navigation.navigate("UserProfile", { userId: post.user.id })} style={styles.authorLeft}>
            <Avatar user={post.user} size={46} me={post.user.id === me?.id} />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName} numberOfLines={1}>{post.user.name}</Text>
              <Text style={styles.authorSub} numberOfLines={1}>{sub}</Text>
            </View>
          </Pressable>
          {author && author.friendStatus !== "self" && (
            <View style={{ width: 150 }}>
              <FriendActionButton userId={post.user.id} status={author.friendStatus} variant="small" onChanged={onAuthorChanged} />
            </View>
          )}
        </View>
        <Text style={styles.postText}>{post.text}</Text>
        <PostPhotos photos={post.photos} height={190} />
        {post.beer && (
          <PostBeerChip beer={post.beer} rating={post.rating} onPress={() => navigation.navigate("BeerDetail", { beerId: post.beer!.id })} />
        )}
        <View style={styles.pills}>
          <LikePill liked={post.likedByMe} count={post.likeCount} onPress={toggleLike} />
          <CommentPill count={comments.length} />
        </View>
      </View>
      <View style={styles.divider} />
    </View>
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>Обсуждение</Text>
        <Pressable onPress={postMenu} hitSlop={8} style={styles.menuBtn}>
          <Icon name={post.canDelete ? "trash" : "dots"} color={colors.text} size={20} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.noComments}>Пока нет комментариев — начни обсуждение</Text>}
          renderItem={({ item }) => (
            <View style={[styles.comment, item.parentId ? styles.reply : null]}>
              <Avatar user={item.user} size={36} me={item.user.id === me?.id} />
              <View style={styles.commentBody}>
                <Text style={styles.commentName}>
                  {item.user.name} <Text style={styles.commentTime}>· {timeAgo(item.createdAt)}</Text>
                </Text>
                <Text style={styles.commentText}>{item.text}</Text>
                <View style={styles.commentActions}>
                  <Pressable onPress={() => toggleCommentLike(item)} hitSlop={6} style={styles.commentAction}>
                    <Icon name="heart" color={item.likedByMe ? colors.primary : colors.textMuted} size={14} filled={item.likedByMe} />
                    <Text style={[styles.commentActionText, item.likedByMe && { color: colors.primary }]}>{item.likeCount}</Text>
                  </Pressable>
                  <Pressable onPress={() => startReply(item)} hitSlop={6}>
                    <Text style={styles.commentActionText}>Ответить</Text>
                  </Pressable>
                  {item.canDelete && (
                    <Pressable onPress={() => confirmDeleteComment(item)} hitSlop={6}>
                      <Text style={styles.commentActionText}>Удалить</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          )}
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {replyTo && (
            <View style={styles.replyChip}>
              <Text style={styles.replyChipText} numberOfLines={1}>Ответ для {replyTo.user.name}</Text>
              <Pressable onPress={() => { setReplyTo(null); setText(""); }} hitSlop={8}>
                <Icon name="close" color={colors.textMuted} size={14} strokeWidth={2.75} />
              </Pressable>
            </View>
          )}
          <View style={styles.composerRow}>
            {me && <Avatar user={me} size={38} me />}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? `Ответить ${replyTo.user.name.split(" ")[0]}…` : "Написать комментарий…"}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={500}
              multiline
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]}
            >
              <Icon name="arrowUp" color={colors.background} size={20} strokeWidth={2.75} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: 10 },
  topTitle: { flex: 1, fontFamily: fonts.display, fontSize: 20, color: colors.text },
  menuBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },

  list: { paddingBottom: spacing.md },
  postBlock: { paddingHorizontal: spacing.lg, paddingTop: 8, gap: 12 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  authorLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  authorName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  authorSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  postText: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.text },
  pills: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  divider: { height: 8, backgroundColor: colors.border, marginTop: 10 },

  noComments: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: "center", padding: spacing.xl },
  comment: { flexDirection: "row", gap: 12, paddingHorizontal: spacing.lg, paddingTop: 18 },
  reply: { marginLeft: 48 },
  commentBody: { flex: 1, gap: 4 },
  commentName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  commentTime: { fontFamily: fonts.body, color: colors.textMuted },
  commentText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  commentActions: { flexDirection: "row", gap: 16, paddingTop: 2 },
  commentAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentActionText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted },

  composer: { backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  replyChip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  replyChipText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#474238" },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
