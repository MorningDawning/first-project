import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "./Avatar";
import { BeerArt } from "./BeerArt";
import { FriendActionButton } from "./FriendActionButton";
import { Icon } from "./icons/Icon";
import { resolveMediaUrl } from "../api/config";
import { plural, stars, timeAgo } from "../lib/time";
import { colors, fonts, matchTint, radius, spacing } from "../theme/colors";
import { FeedPost, FriendStatus, PostBeer } from "../types";

export function PostPhotos({ photos, height = 150 }: { photos: string[]; height?: number }) {
  if (photos.length === 0) return null;
  const single = photos.length === 1;
  return (
    <View style={styles.photos}>
      {photos.slice(0, 3).map((url) => (
        <Image
          key={url}
          source={{ uri: resolveMediaUrl(url) ?? undefined }}
          style={[styles.photo, { height: single ? height + 50 : height }, single ? styles.photoSingle : styles.photoMulti]}
        />
      ))}
    </View>
  );
}

export function PostBeerChip({ beer, rating, onPress }: { beer: PostBeer; rating: number | null; onPress?: () => void }) {
  const tint = beer.matchPercent != null ? matchTint(beer.matchPercent) : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.beerChip, pressed && { opacity: 0.85 }]}>
      <BeerArt name={beer.name} imageUrl={beer.imageUrl} size={52} />
      <View style={styles.beerInfo}>
        <Text style={styles.beerName} numberOfLines={1}>{beer.name}</Text>
        <Text style={styles.beerSub} numberOfLines={1}>{beer.brewery.name} · {beer.style}</Text>
        {rating != null && <Text style={styles.beerStars}>{stars(rating)}</Text>}
      </View>
      {tint && beer.matchPercent != null && (
        <View style={[styles.matchPill, { backgroundColor: tint.bg }]}>
          <Text style={[styles.matchText, { color: tint.fg }]}>{beer.matchPercent}% тебе</Text>
        </View>
      )}
    </Pressable>
  );
}

export function LikePill({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.pill, liked ? styles.pillLiked : styles.pillIdle]}>
      <Icon name="heart" color={liked ? "#8C491A" : "#474238"} size={16} filled={liked} />
      <Text style={[styles.pillText, { color: liked ? "#8C491A" : "#474238" }]}>{count}</Text>
    </Pressable>
  );
}

export function CommentPill({ count, onPress }: { count: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.pill, styles.pillIdle]}>
      <Icon name="comment" color="#474238" size={16} />
      <Text style={[styles.pillText, { color: "#474238" }]}>{count}</Text>
    </Pressable>
  );
}

type Props = {
  post: FeedPost;
  onPress: () => void;
  onLike: () => void;
  onOpenUser: () => void;
  onOpenBeer: (beerId: string) => void;
  onFriendChanged?: (userId: string, status: FriendStatus) => void;
};

export function PostCard({ post, onPress, onLike, onOpenUser, onOpenBeer, onFriendChanged }: Props) {
  const mutual = post.author?.mutualFriends ?? 0;
  const meta = [
    mutual > 0 ? `${mutual} ${plural(mutual, "общий друг", "общих друга", "общих друзей")}` : null,
    post.place,
    timeAgo(post.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");
  const showFriendButton = post.author && post.author.friendStatus !== "friends" && post.author.friendStatus !== "self";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}>
      <View style={styles.header}>
        <Pressable onPress={onOpenUser} style={styles.author}>
          <Avatar user={post.user} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{post.user.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
          </View>
        </Pressable>
        {showFriendButton && post.author && (
          <FriendActionButton
            userId={post.user.id}
            status={post.author.friendStatus}
            variant="icon"
            onChanged={(s) => onFriendChanged?.(post.user.id, s)}
          />
        )}
      </View>

      <Text style={styles.text}>{post.text}</Text>
      <PostPhotos photos={post.photos} />
      {post.beer && <PostBeerChip beer={post.beer} rating={post.rating} onPress={() => onOpenBeer(post.beer!.id)} />}

      <View style={styles.actions}>
        <LikePill liked={post.likedByMe} count={post.likeCount} onPress={onLike} />
        <CommentPill count={post.commentCount} onPress={onPress} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  author: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },

  photos: { flexDirection: "row", gap: 8 },
  photo: { backgroundColor: colors.border },
  photoSingle: { flex: 1, borderRadius: 20 },
  photoMulti: { flex: 1, borderRadius: 16 },

  beerChip: {
    backgroundColor: colors.border,
    borderRadius: 20,
    padding: 8,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  beerInfo: { flex: 1, gap: 2 },
  beerName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  beerSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  beerStars: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#B2622D", letterSpacing: 1 },
  matchPill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  matchText: { fontFamily: fonts.bodyBold, fontSize: 13 },

  actions: { flexDirection: "row", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  pillIdle: { backgroundColor: "#EEE7DB" },
  pillLiked: { backgroundColor: "#FBDFD3" },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
