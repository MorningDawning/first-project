import { Beer, Brewery, Post, User } from "@prisma/client";
import { prisma } from "./prisma";
import { TasteVector, computeUserTasteProfile, matchPercent, tasteVector } from "./taste";
import { isConnected } from "./realtime";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/** В сети: открыто живое соединение или заходил в приложение в последние пару минут. */
export function isOnline(user: { id: string; lastSeenAt: Date | null }): boolean {
  if (isConnected(user.id)) return true;
  return user.lastSeenAt !== null && Date.now() - user.lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}

export type UserBrief = { id: string; name: string; username: string | null; avatarUrl: string | null };

export function userBrief(u: User): UserBrief {
  return { id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl };
}

// ---------- @username ----------

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

async function freeUsername(base: string): Promise<string> {
  const clean = base.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 14);
  const stem = clean.length >= 3 ? clean : "user";
  let candidate = stem;
  for (let i = 0; i < 20; i++) {
    if (!(await prisma.user.findUnique({ where: { username: candidate } }))) return candidate;
    candidate = `${stem}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${stem}${Date.now().toString().slice(-6)}`;
}

export async function usernameFromEmail(email: string): Promise<string> {
  return freeUsername(email.split("@")[0]);
}

/** Старые аккаунты появились до поля username — выдаём им хэндл при первом обращении. */
export async function ensureUsername(user: User): Promise<User> {
  if (user.username) return user;
  const username = await usernameFromEmail(user.email);
  return prisma.user.update({ where: { id: user.id }, data: { username } });
}

// ---------- friendship ----------

export type FriendStatus = "self" | "none" | "friends" | "outgoing" | "incoming";
export type Relation = { status: FriendStatus; requestId: string | null };

export async function friendIdsOf(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "accepted", OR: [{ userId }, { friendId: userId }] },
  });
  return rows.map((r) => (r.userId === userId ? r.friendId : r.userId));
}

export async function relationsTo(me: string, otherIds: string[]): Promise<Map<string, Relation>> {
  const result = new Map<string, Relation>();
  for (const id of otherIds) result.set(id, { status: id === me ? "self" : "none", requestId: null });
  const others = otherIds.filter((id) => id !== me);
  if (others.length === 0) return result;

  const rows = await prisma.friendship.findMany({
    where: { OR: [{ userId: me, friendId: { in: others } }, { friendId: me, userId: { in: others } }] },
  });
  for (const r of rows) {
    const other = r.userId === me ? r.friendId : r.userId;
    if (r.status === "accepted") result.set(other, { status: "friends", requestId: r.id });
    else result.set(other, { status: r.userId === me ? "outgoing" : "incoming", requestId: r.id });
  }
  return result;
}

export async function relationTo(me: string, other: string): Promise<Relation> {
  return (await relationsTo(me, [other])).get(other)!;
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  return (await relationTo(a, b)).status === "friends";
}

/** Сколько общих друзей у меня с каждым из otherIds. */
export async function mutualFriendCounts(myFriendIds: Set<string>, otherIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(otherIds.map((id) => [id, 0]));
  if (otherIds.length === 0 || myFriendIds.size === 0) return counts;

  const rows = await prisma.friendship.findMany({
    where: { status: "accepted", OR: [{ userId: { in: otherIds } }, { friendId: { in: otherIds } }] },
  });
  for (const r of rows) {
    if (counts.has(r.userId) && myFriendIds.has(r.friendId)) counts.set(r.userId, counts.get(r.userId)! + 1);
    if (counts.has(r.friendId) && myFriendIds.has(r.userId)) counts.set(r.friendId, counts.get(r.friendId)! + 1);
  }
  return counts;
}

// ---------- taste between people ----------

const SHARED_LIKE: Record<keyof TasteVector, string> = {
  aroma: "яркий хмель",
  bitterness: "горчинку",
  sweetness: "сладкое",
  sourness: "кислинку",
  body: "плотное тело",
};
const DIFF_HIGH: Record<keyof TasteVector, string> = {
  sweetness: "пиво посладше",
  bitterness: "пиво погорче",
  sourness: "кислое пиво",
  body: "пиво поплотнее",
  aroma: "пиво с ярким хмелем",
};
const DIFF_LOW: Record<keyof TasteVector, string> = {
  sweetness: "пиво посуше",
  bitterness: "пиво помягче",
  sourness: "пиво без кислинки",
  body: "пиво полегче",
  aroma: "пиво со сдержанным ароматом",
};
const AXES = Object.keys(SHARED_LIKE) as (keyof TasteVector)[];

export function compareTaste(mine: TasteVector, theirs: TasteVector, theirName: string) {
  const percent = matchPercent(mine, theirs);
  const first = theirName.split(" ")[0];

  const shared = AXES.filter((a) => mine[a] >= 60 && theirs[a] >= 60).sort(
    (a, b) => Math.min(mine[b], theirs[b]) - Math.min(mine[a], theirs[a])
  )[0];
  const diffAxis = [...AXES].sort((a, b) => Math.abs(mine[b] - theirs[b]) - Math.abs(mine[a] - theirs[a]))[0];
  const diff = Math.abs(mine[diffAxis] - theirs[diffAxis]);

  const parts: string[] = [];
  parts.push(shared ? `Оба любите ${SHARED_LIKE[shared]}.` : "Вкусы пересекаются не сильно — зато есть что открыть друг у друга.");
  if (diff >= 25) {
    const phrase = theirs[diffAxis] > mine[diffAxis] ? DIFF_HIGH[diffAxis] : DIFF_LOW[diffAxis];
    parts.push(`${first} чаще выбирает ${phrase}.`);
  }
  return { percent, note: parts.join(" ") };
}

/** Похожесть вкуса двух людей; null, если у кого-то из них ещё нет профиля. */
export async function tasteMatchBetween(a: string, b: string): Promise<number | null> {
  const [pa, pb] = await Promise.all([computeUserTasteProfile(a), computeUserTasteProfile(b)]);
  return pa && pb ? matchPercent(pa, pb) : null;
}

// ---------- posts ----------

export const postInclude = (viewerId: string) =>
  ({
    user: true,
    beer: { include: { brewery: true } },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  }) as const;

export type PostRow = Post & {
  user: User;
  beer: (Beer & { brewery: Brewery }) | null;
  _count: { likes: number; comments: number };
  likes: { userId: string }[];
};

export function serializePost(post: PostRow, viewerProfile: TasteVector | null) {
  return {
    id: post.id,
    text: post.text,
    place: post.place,
    visibility: post.visibility,
    photos: JSON.parse(post.photos) as string[],
    createdAt: post.createdAt,
    rating: post.rating,
    user: userBrief(post.user),
    beer: post.beer
      ? {
          id: post.beer.id,
          name: post.beer.name,
          style: post.beer.style,
          imageUrl: post.beer.imageUrl,
          brewery: { id: post.beer.brewery.id, name: post.beer.brewery.name },
          matchPercent: viewerProfile ? matchPercent(viewerProfile, tasteVector(post.beer)) : null,
        }
      : null,
    likeCount: post._count.likes,
    likedByMe: post.likes.length > 0,
    commentCount: post._count.comments,
  };
}

export async function canViewPost(viewerId: string, post: { userId: string; visibility: string }): Promise<boolean> {
  if (post.userId === viewerId || post.visibility === "all") return true;
  return areFriends(viewerId, post.userId);
}
