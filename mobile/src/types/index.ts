export type TasteProfile = {
  sweetness: number;
  bitterness: number;
  sourness: number;
  body: number;
  aroma: number;
};

export type Brewery = {
  id: string;
  name: string;
  country: string;
  city?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  beerCount?: number;
};

export type BeerSummary = {
  id: string;
  name: string;
  style: string;
  abv: number;
  ibu: number | null;
  description: string;
  imageUrl: string | null;
  brewery: { id: string; name: string; country: string; logoUrl?: string | null };
  tasteProfile: TasteProfile;
  tasteVotes: number;
  tasteSource: "style" | "users"; // откуда вкус: оценка по стилю или голоса пользователей
  foodPairings: string[];
  matchPercent: number | null;
  isWishlisted: boolean;
};

export type Review = {
  id: string;
  rating: number;
  text: string | null;
  tags: string[];
  isFriend: boolean; // отзыв человека из друзей
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

export type BeerDetail = BeerSummary & {
  avgRating: number | null;
  reviews: Review[];
  recommendations: BeerSummary[];
};

export type BarEntry = {
  scanId: string;
  scannedAt: string;
  rating: number | null;
  beer: {
    id: string;
    name: string;
    style: string;
    imageUrl: string | null;
    brewery: { id: string; name: string };
  };
};

export type UserBrief = { id: string; name: string; username: string | null; avatarUrl: string | null };

export type FriendStatus = "self" | "none" | "friends" | "outgoing" | "incoming";

export type PostBeer = {
  id: string;
  name: string;
  style: string;
  imageUrl: string | null;
  brewery: { id: string; name: string };
  matchPercent: number | null;
};

export type FeedPost = {
  id: string;
  text: string;
  place: string | null;
  visibility: "friends" | "all";
  photos: string[];
  createdAt: string;
  rating: number | null;
  user: UserBrief;
  beer: PostBeer | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  /** Есть у постов из «Для тебя» и на экране поста: кем автор приходится мне. */
  author?: { friendStatus: FriendStatus; mutualFriends: number; requestId?: string | null };
  canDelete?: boolean;
};

export type PostComment = {
  id: string;
  /** Пустая строка, если в комментарии только фото или пиво. */
  text: string;
  createdAt: string;
  parentId: string | null;
  user: UserBrief;
  photo: { url: string; width: number | null; height: number | null } | null;
  beer: PostBeer | null;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
};

export type FeedPage = { posts: FeedPost[]; nextBefore: string | null };

export type FriendItem = UserBrief & { match: number | null; online: boolean };

export type FriendRequest = {
  requestId: string;
  createdAt: string;
  user: UserBrief;
  match: number | null;
  mutualFriends: number;
};

export type SimilarPerson = {
  user: UserBrief;
  match: number;
  friendStatus: FriendStatus;
  requestId: string | null;
};

export type PersonSearchResult = SimilarPerson & {
  city: string | null;
  mutualFriends: number;
  match: number | null;
};

export type PublicProfile = UserBrief & {
  bio: string | null;
  city: string | null;
  online: boolean;
  relation: { status: FriendStatus; requestId: string | null };
  mutualFriends: number;
  stats: { friendCount: number; scanCount: number; reviewCount: number; postCount: number };
  taste: { percent: number; note: string } | null;
};

export type UserBarItem = {
  beer: { id: string; name: string; style: string; imageUrl: string | null; brewery: { id: string; name: string } };
  rating: number | null;
  scannedAt: string;
};

export type ChatSummary = {
  id: string;
  type: "direct" | "group";
  title: string;
  peer: (UserBrief & { online: boolean }) | null;
  memberCount: number;
  unread: number;
  lastMessageAt: string;
  lastMessage: {
    id: string;
    kind: "user" | "system";
    text: string | null;
    beerName: string | null;
    hasPhoto: boolean;
    hasAudio: boolean;
    deleted: boolean;
    senderName: string | null;
    fromMe: boolean;
    createdAt: string;
  } | null;
};

/** Цитата исходного сообщения внутри ответа. */
export type MessageQuote = {
  id: string;
  senderName: string;
  fromMe: boolean;
  deleted: boolean;
  text: string | null;
  kind: "text" | "photo" | "beer" | "voice" | "deleted";
  beerName: string | null;
};

export type ChatMessage = {
  id: string;
  kind: "user" | "system";
  text: string | null;
  fromMe: boolean;
  createdAt: string;
  sender: UserBrief;
  /** Удалено у всех: остаётся серая заглушка. */
  deleted: boolean;
  editedAt: string | null;
  replyTo: MessageQuote | null;
  audio: { url: string; durationMs: number } | null;
  photo: { url: string; width: number | null; height: number | null } | null;
  beer: {
    id: string;
    name: string;
    style: string;
    abv: number;
    imageUrl: string | null;
    brewery: { id: string; name: string };
    match: number | null;
    matchWho: "you" | "peer" | null;
  } | null;
  /** Личный чат: когда собеседник прочитал. */
  readAt: string | null;
  /** Группа: сколько из остальных участников прочитали. */
  readBy: number;
};

export type ChatMemberInfo = UserBrief & { role: "owner" | "member"; online: boolean };

export type ChatInfo = {
  id: string;
  type: "direct" | "group";
  title: string;
  canSend: boolean;
  myRole: "owner" | "member";
  otherCount: number;
  peer: (UserBrief & { online: boolean; match: number | null }) | null;
  members: ChatMemberInfo[];
};

export type ChatThread = { chat: ChatInfo; messages: ChatMessage[] };

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  username: string | null;
  city: string | null;
  ageConfirmed: boolean; // false у старых аккаунтов до подтверждения 18+
  createdAt: string;
  stats: { scanCount: number; reviewCount: number };
};

export type TasteProfileResponse = {
  profile: TasteProfile | null;
  favoriteStyle: string | null;
  beersScanned: number;
  stylesTried: number;
  personaTitle: string | null;
  hasEnoughData: boolean;
};

export type TastePersona = { title: string; tagline: string; category: string };

export type QuizResult = {
  profile: TasteProfile;
  persona: TastePersona;
  recommendedBeer: BeerSummary | null;
};
