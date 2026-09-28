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
  foodPairings: string[];
  matchPercent: number | null;
  isWishlisted: boolean;
};

export type Review = {
  id: string;
  rating: number;
  text: string | null;
  tags: string[];
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
  text: string;
  createdAt: string;
  parentId: string | null;
  user: UserBrief;
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

export type Conversation = {
  user: UserBrief;
  online: boolean;
  unread: number;
  lastMessage: { id: string; text: string | null; beerName: string | null; fromMe: boolean; createdAt: string };
};

export type ChatMessage = {
  id: string;
  text: string | null;
  fromMe: boolean;
  createdAt: string;
  readAt: string | null;
  beer: {
    id: string;
    name: string;
    style: string;
    abv: number;
    imageUrl: string | null;
    brewery: { id: string; name: string };
    matchForRecipient: number | null;
  } | null;
};

export type ChatThread = {
  peer: UserBrief & { online: boolean; match: number | null };
  canSend: boolean;
  messages: ChatMessage[];
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  username: string | null;
  city: string | null;
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
