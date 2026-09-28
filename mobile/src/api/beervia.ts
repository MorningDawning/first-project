import { api } from "./client";
import {
  BarEntry,
  BeerDetail,
  BeerSummary,
  Brewery,
  FeedPage,
  FeedPost,
  FriendItem,
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
  register: (email: string, password: string, name: string) =>
    api.post<AuthResponse>("/auth/register", { email, password, name }).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data),
};

export const userApi = {
  me: () => api.get<UserProfile>("/me").then((r) => r.data),
  updateMe: (data: { name?: string; bio?: string; avatarUrl?: string; username?: string; city?: string }) =>
    api.patch<UserProfile>("/me", data).then((r) => r.data),
};

export const beersApi = {
  search: (params: { q?: string; style?: string }) =>
    api.get<BeerSummary[]>("/beers", { params }).then((r) => r.data),
  styles: () => api.get<string[]>("/beers/styles").then((r) => r.data),
  detail: (id: string) => api.get<BeerDetail>(`/beers/${id}`).then((r) => r.data),
  review: (id: string, rating: number, text?: string, tags?: string[]) =>
    api.post(`/beers/${id}/reviews`, { rating, text, tags }).then((r) => r.data),
};

export const wishlistApi = {
  list: () => api.get<BeerSummary[]>("/wishlist").then((r) => r.data),
  add: (beerId: string) => api.post(`/wishlist/${beerId}`).then((r) => r.data),
  remove: (beerId: string) => api.delete(`/wishlist/${beerId}`).then((r) => r.data),
};

export const scanApi = {
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
  addComment: (id: string, text: string, parentId?: string) =>
    api.post<PostComment>(`/posts/${id}/comments`, { text, parentId }).then((r) => r.data),
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
};

export const uploadsApi = {
  /** Загружает фото для поста, возвращает относительную ссылку вида /uploads/<user>/<file>. */
  photo: (uri: string) => {
    const form = new FormData();
    form.append("photo", { uri, name: "post.jpg", type: "image/jpeg" } as unknown as Blob);
    return api
      .post<{ url: string }>("/uploads", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.url);
  },
};
