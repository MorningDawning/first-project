import { Platform } from "react-native";
import { api } from "./client";
import {
  BarEntry,
  ChatSummary,
  ChatThread,
  BeerDetail,
  BeerSummary,
  Brewery,
  FeedPage,
  FeedPost,
  FriendItem,
  PersonSearchResult,
  FriendRequest,
  FriendStatus,
  PostComment,
  PublicProfile,
  SimilarPerson,
  UserBarItem,
  QuizResult,
  TasteProfileResponse,
  UserProfile,
} from "../types";

export type AuthResponse = {
  token: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
};

export const authApi = {
  register: (email: string, password: string, name: string, birthDate: string) =>
    api.post<AuthResponse>("/auth/register", { email, password, name, birthDate, acceptTerms: true }).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data),
};

export const userApi = {
  me: () => api.get<UserProfile>("/me").then((r) => r.data),
  updateMe: (data: { name?: string; bio?: string; avatarUrl?: string; username?: string; city?: string }) =>
    api.patch<UserProfile>("/me", data).then((r) => r.data),
  confirmAge: (birthDate: string) => api.post("/me/age", { birthDate, acceptTerms: true }).then((r) => r.data),
  deleteAccount: (password: string) => api.delete("/me", { data: { password } }).then((r) => r.data),
};

export const legalApi = {
  privacy: () =>
    api
      .get<{ title: string; updatedAt: string; sections: { heading: string; body: string }[] }>("/legal/privacy")
      .then((r) => r.data),
};

export const beersApi = {
  search: (params: { q?: string; style?: string }) =>
    api.get<BeerSummary[]>("/beers", { params }).then((r) => r.data),
  styles: () => api.get<string[]>("/beers/styles").then((r) => r.data),
  detail: (id: string) => api.get<BeerDetail>(`/beers/${id}`).then((r) => r.data),
  add: (beer: { name: string; breweryName: string; style: string; abv: number; barcode?: string }) =>
    api.post<{ id: string; created: boolean }>("/beers", beer).then((r) => r.data),
  review: (id: string, rating: number, text?: string, tags?: string[]) =>
    api.post(`/beers/${id}/reviews`, { rating, text, tags }).then((r) => r.data),
};

export const wishlistApi = {
  list: () => api.get<BeerSummary[]>("/wishlist").then((r) => r.data),
  add: (beerId: string) => api.post(`/wishlist/${beerId}`).then((r) => r.data),
  remove: (beerId: string) => api.delete(`/wishlist/${beerId}`).then((r) => r.data),
};

export const scanApi = {
  /** Поиск по штрихкоду банки или бутылки. */
  scanBarcode: (barcode: string) => api.post<BeerDetail>("/scan", { barcode }).then((r) => r.data),
  /** Uploads a captured label/can photo for recognition. */
  scan: (photoUri: string) => {
    const form = new FormData();
    // React Native's FormData accepts this {uri,name,type} shape for file parts.
    form.append("photo", { uri: photoUri, name: "scan.jpg", type: "image/jpeg" } as unknown as Blob);
    return api
      .post<BeerDetail>("/scan", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
};

export const barApi = {
  list: () => api.get<BarEntry[]>("/bar").then((r) => r.data),
  add: (beerId: string) => api.post(`/bar/${beerId}`).then((r) => r.data),
};

export const breweriesApi = {
  list: (q?: string) => api.get<Brewery[]>("/breweries", { params: { q } }).then((r) => r.data),
  detail: (id: string) =>
    api.get<Brewery & { beers: { id: string; name: string; style: string; imageUrl: string | null }[] }>(
      `/breweries/${id}`
    ).then((r) => r.data),
};

export const tasteProfileApi = {
  get: () => api.get<TasteProfileResponse>("/taste-profile").then((r) => r.data),
  submitQuiz: (answers: {
    bitterness: number;
    body: number;
    aroma: number;
    sweetness: number;
    sourness: number;
    targetAbv: number;
    occasion: "classic" | "adventurous";
  }) => api.post<QuizResult>("/taste-profile/quiz", answers).then((r) => r.data),
};

export type NewPost = {
  text: string;
  beerId?: string;
  rating?: number;
  place?: string;
  visibility: "friends" | "all";
  photos: string[];
};

export type LikeState = { likeCount: number; likedByMe: boolean };

export const feedApi = {
  list: (tab: "friends" | "foryou", before?: string) =>
    api.get<FeedPage>("/feed", { params: { tab, before } }).then((r) => r.data),
  people: () => api.get<SimilarPerson[]>("/feed/people").then((r) => r.data),
  create: (post: NewPost) => api.post<FeedPost>("/feed", post).then((r) => r.data),
};

export const postsApi = {
  get: (id: string) => api.get<FeedPost>(`/posts/${id}`).then((r) => r.data),
  remove: (id: string) => api.delete(`/posts/${id}`).then((r) => r.data),
  like: (id: string) => api.post<LikeState>(`/posts/${id}/like`).then((r) => r.data),
  unlike: (id: string) => api.delete<LikeState>(`/posts/${id}/like`).then((r) => r.data),
  comments: (id: string) => api.get<PostComment[]>(`/posts/${id}/comments`).then((r) => r.data),
  addComment: (id: string, comment: OutgoingComment) =>
    api.post<PostComment>(`/posts/${id}/comments`, comment).then((r) => r.data),
  report: (id: string, reason?: string) => api.post(`/posts/${id}/report`, { reason }).then((r) => r.data),
};

export const commentsApi = {
  like: (id: string) => api.post<LikeState>(`/comments/${id}/like`).then((r) => r.data),
  unlike: (id: string) => api.delete<LikeState>(`/comments/${id}/like`).then((r) => r.data),
  remove: (id: string) => api.delete(`/comments/${id}`).then((r) => r.data),
};

export const friendsApi = {
  list: () => api.get<FriendItem[]>("/friends").then((r) => r.data),
  requests: () => api.get<FriendRequest[]>("/friends/requests").then((r) => r.data),
  sendRequest: (userId: string) =>
    api.post<{ status: FriendStatus }>("/friends/requests", { userId }).then((r) => r.data),
  accept: (requestId: string) => api.post(`/friends/requests/${requestId}/accept`).then((r) => r.data),
  decline: (requestId: string) => api.post(`/friends/requests/${requestId}/decline`).then((r) => r.data),
  remove: (userId: string) => api.delete(`/friends/${userId}`).then((r) => r.data),
};

export const profilesApi = {
  get: (id: string) => api.get<PublicProfile>(`/users/${id}`).then((r) => r.data),
  bar: (id: string) => api.get<UserBarItem[]>(`/users/${id}/bar`).then((r) => r.data),
  posts: (id: string) => api.get<FeedPost[]>(`/users/${id}/posts`).then((r) => r.data),
  report: (id: string, reason?: string) => api.post(`/users/${id}/report`, { reason }).then((r) => r.data),
  search: (q: string) =>
    api.get<PersonSearchResult[]>("/users/search", { params: { q } }).then((r) => r.data),
};

export const uploadsApi = {
  /** Загружает фото для поста, возвращает относительную ссылку вида /uploads/<user>/<file>. */
  photo: async (uri: string) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      // В браузере файл передаётся настоящим Blob; форма {uri, name, type} — только для телефона.
      form.append("photo", await (await fetch(uri)).blob(), "post.jpg");
    } else {
      form.append("photo", { uri, name: "post.jpg", type: "image/jpeg" } as unknown as Blob);
    }
    return api
      .post<{ url: string }>("/uploads", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.url);
  },
  /** Голосовое сообщение: файл, записанный на телефоне (m4a), возвращает ссылку на загрузку. */
  audio: async (uri: string) => {
    const form = new FormData();
    const ext = /\.(m4a|mp3|wav|caf|webm|ogg)$/i.exec(uri)?.[1].toLowerCase() ?? "m4a";
    const type = ext === "m4a" ? "audio/mp4" : `audio/${ext}`;
    if (Platform.OS === "web") {
      form.append("audio", await (await fetch(uri)).blob(), `voice.${ext}`);
    } else {
      form.append("audio", { uri, name: `voice.${ext}`, type } as unknown as Blob);
    }
    return api
      .post<{ url: string }>("/uploads/audio", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.url);
  },
};

export type OutgoingMessage = {
  text?: string;
  beerId?: string;
  photo?: { url: string; width?: number; height?: number };
  audio?: { url: string; durationMs: number };
  replyToId?: string;
};

export type OutgoingComment = {
  text?: string;
  parentId?: string;
  beerId?: string;
  photo?: { url: string; width?: number; height?: number };
};

export const chatsApi = {
  list: () => api.get<ChatSummary[]>("/chats").then((r) => r.data),
  unreadCount: () => api.get<{ count: number }>("/chats/unread-count").then((r) => r.data.count),
  thread: (chatId: string) => api.get<ChatThread>(`/chats/${chatId}`).then((r) => r.data),
  openDirect: (userId: string) => api.post<{ id: string }>("/chats/direct", { userId }).then((r) => r.data.id),
  createGroup: (title: string, memberIds: string[]) =>
    api.post<{ id: string }>("/chats/group", { title, memberIds }).then((r) => r.data.id),
  send: (chatId: string, message: OutgoingMessage) =>
    api.post<{ id: string }>(`/chats/${chatId}/messages`, message).then((r) => r.data),
  editMessage: (chatId: string, messageId: string, text: string) =>
    api.patch(`/chats/${chatId}/messages/${messageId}`, { text }).then((r) => r.data),
  deleteMessage: (chatId: string, messageId: string) =>
    api.delete(`/chats/${chatId}/messages/${messageId}`).then((r) => r.data),
  rename: (chatId: string, title: string) => api.patch(`/chats/${chatId}`, { title }).then((r) => r.data),
  addMembers: (chatId: string, userIds: string[]) =>
    api.post(`/chats/${chatId}/members`, { userIds }).then((r) => r.data),
  removeMember: (chatId: string, userId: string) =>
    api.delete(`/chats/${chatId}/members/${userId}`).then((r) => r.data),
};
