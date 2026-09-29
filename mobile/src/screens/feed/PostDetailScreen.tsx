import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../components/Screen";
import { AttachSheet } from "../../components/AttachSheet";
import { Avatar } from "../../components/Avatar";
import { BeerArt } from "../../components/BeerArt";
import { BeerPicker, PickedBeer } from "../../components/BeerPicker";
import { ImageViewer } from "../../components/ImageViewer";
import { BackButton } from "../../components/BackButton";
import { FriendActionButton } from "../../components/FriendActionButton";
import { CommentPill, LikePill, PostBeerChip, PostPhotos } from "../../components/PostCard";
import { Icon } from "../../components/icons/Icon";
import { ErrorView, LoadingView } from "../../components/StateViews";
import { useAuth } from "../../context/AuthContext";
import { commentsApi, postsApi, uploadsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { resolveMediaUrl } from "../../api/config";
import { PickedImage, pickImage } from "../../lib/pickImage";
import { plural, timeAgo } from "../../lib/time";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { FeedPost, FriendStatus, PostComment } from "../../types";

type Props = NativeStackScreenProps<FeedStackParamList, "PostDetail">;

function commentPhotoSize(width: number | null, height: number | null) {
  const MAX_W = 230;
  const MAX_H = 280;
  if (!width || !height) return { width: MAX_W, height: MAX_W };
  const ratio = width / height;
  let w = MAX_W;
  let h = w / ratio;
  if (h > MAX_H) {
    h = MAX_H;
    w = h * ratio;
  }
  return { width: Math.max(120, w), height: Math.max(120, h) };
}

export function PostDetailScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const { user: me } = useAuth();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAvoidance();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [sending, setSending] = useState(false);
  const [photoAtt, setPhotoAtt] = useState<PickedImage | null>(null);
  const [beerAtt, setBeerAtt] = useState<PickedBeer | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [beerPickerOpen, setBeerPickerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const listRef = useRef<FlatList<PostComment>>(null);
  const nearBottom = useRef(false);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const pendingScrollId = useRef<string | null>(null);

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

  // Свой новый комментарий или ответ подводит экран к нему, как в мессенджере.
  useEffect(() => {
    const id = pendingScrollId.current;
    if (!id) return;
    const index = comments.findIndex((c) => c.id === id);
    if (index < 0) return;
    pendingScrollId.current = null;
    const timer = setTimeout(() => {
      if (index === comments.length - 1) listRef.current?.scrollToEnd({ animated: true });
      else listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, 80);
    return () => clearTimeout(timer);
  }, [comments]);

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
    // Когда поднимется клавиатура, комментарий, на который отвечаешь, остаётся на виду.
    const index = comments.findIndex((x) => x.id === c.id);
    if (index >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 }), 350);
    }
    // Ответ на ответ привязывается к корневому комментарию, поэтому обращаемся по имени.
    if (c.parentId && !text) setText(`${c.user.name.split(" ")[0]}, `);
  }

  const attachOptions = useMemo(
    () => [
      { key: "beer", label: "Пиво", icon: "scan" as const, onPress: () => setBeerPickerOpen(true) },
      { key: "library", label: "Фото из галереи", icon: "image" as const, onPress: () => pickPhoto("library") },
      { key: "camera", label: "Сделать фото", icon: "camera" as const, onPress: () => pickPhoto("camera") },
    ],
    []
  );

  async function pickPhoto(source: "library" | "camera") {
    const picked = await pickImage(source);
    if (picked) setPhotoAtt(picked);
  }

  const canSend = text.trim().length > 0 || photoAtt !== null || beerAtt !== null;

  async function send() {
    const body = text.trim();
    if (!canSend || sending || !post) return;
    setSending(true);
    try {
      // Фото загружаем в момент отправки: пока комментарий не ушёл, его можно передумать.
      const photoUrl = photoAtt ? await uploadsApi.photo(photoAtt.uri) : null;
      const created = await postsApi.addComment(post.id, {
        text: body || undefined,
        parentId: replyTo ? replyTo.parentId ?? replyTo.id : undefined,
        beerId: beerAtt?.id,
        photo: photoUrl && photoAtt ? { url: photoUrl, width: photoAtt.width, height: photoAtt.height } : undefined,
      });
      setText("");
      setReplyTo(null);
      setPhotoAtt(null);
      setBeerAtt(null);
      pendingScrollId.current = created.id;
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
            <View style={{ flexShrink: 0 }}>
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

      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
        <FlatList
          ref={listRef}
          data={comments}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
          }}
          scrollEventThrottle={100}
          onContentSizeChange={(_w, h) => {
            contentHeight.current = h;
          }}
          // Когда поднимается клавиатура, список сжимается: если читатель был внизу
          // (или всё помещалось на экране), последние комментарии остаются перед глазами.
          onLayout={(e) => {
            const prev = viewportHeight.current;
            viewportHeight.current = e.nativeEvent.layout.height;
            if (nearBottom.current || (prev > 0 && contentHeight.current <= prev + 1)) {
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }), 150);
          }}
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
                {item.text ? <Text style={styles.commentText}>{item.text}</Text> : null}
                {item.photo && (
                  <Pressable onPress={() => setViewerUrl(item.photo!.url)} style={[styles.commentPhoto, commentPhotoSize(item.photo.width, item.photo.height)]}>
                    <Image source={{ uri: resolveMediaUrl(item.photo.url) ?? undefined }} style={StyleSheet.absoluteFill} />
                  </Pressable>
                )}
                {item.beer && (
                  <PostBeerChip beer={item.beer} rating={null} onPress={() => navigation.navigate("BeerDetail", { beerId: item.beer!.id })} />
                )}
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

        <View style={[styles.composer, { paddingBottom: kb.keyboardVisible ? 12 : Math.max(insets.bottom, 12) }]}>
          {replyTo && (
            <View style={styles.replyChip}>
              <Text style={styles.replyChipText} numberOfLines={1}>Ответ для {replyTo.user.name}</Text>
              <Pressable onPress={() => { setReplyTo(null); setText(""); }} hitSlop={8}>
                <Icon name="close" color={colors.textMuted} size={14} strokeWidth={2.75} />
              </Pressable>
            </View>
          )}
          {(photoAtt || beerAtt) && (
            <View style={styles.attachRow}>
              {photoAtt && (
                <View style={styles.attachThumb}>
                  <Image source={{ uri: photoAtt.uri }} style={StyleSheet.absoluteFill} />
                  <Pressable onPress={() => setPhotoAtt(null)} hitSlop={6} style={styles.attachRemove}>
                    <Icon name="close" color="#fff" size={12} strokeWidth={3} />
                  </Pressable>
                </View>
              )}
              {beerAtt && (
                <View style={styles.attachBeer}>
                  <BeerArt name={beerAtt.name} imageUrl={beerAtt.imageUrl} size={38} />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.attachBeerName} numberOfLines={1}>{beerAtt.name}</Text>
                    <Text style={styles.attachBeerSub} numberOfLines={1}>{beerAtt.brewery.name}</Text>
                  </View>
                  <Pressable onPress={() => setBeerAtt(null)} hitSlop={8}>
                    <Icon name="close" color={colors.textMuted} size={16} strokeWidth={2.75} />
                  </Pressable>
                </View>
              )}
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
            <Pressable onPress={() => setAttachOpen(true)} style={styles.attachBtn} hitSlop={6}>
              <Icon name="plus" color="#474238" size={20} strokeWidth={2.75} />
            </Pressable>
            <Pressable
              onPress={send}
              disabled={!canSend || sending}
              style={[styles.sendBtn, (!canSend || sending) && { opacity: 0.45 }]}
            >
              {sending ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Icon name="arrowUp" color={colors.background} size={20} strokeWidth={2.75} />
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <AttachSheet visible={attachOpen} options={attachOptions} onClose={() => setAttachOpen(false)} />
      <BeerPicker
        visible={beerPickerOpen}
        onClose={() => setBeerPickerOpen(false)}
        onPick={(beer) => {
          setBeerPickerOpen(false);
          setBeerAtt(beer);
        }}
      />
      <ImageViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
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
  commentPhoto: { borderRadius: 16, overflow: "hidden", backgroundColor: colors.border, marginTop: 2 },
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
  attachRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  attachThumb: { width: 56, height: 56, borderRadius: 14, overflow: "hidden", backgroundColor: colors.border },
  attachRemove: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" },
  attachBeer: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 },
  attachBeerName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  attachBeerSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  attachBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
