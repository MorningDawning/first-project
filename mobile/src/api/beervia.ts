import { api } from "./client";
import {
  BarEntry,
  BeerDetail,
  BeerSummary,
  Brewery,
  FriendPost,
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
  updateMe: (data: { name?: string; bio?: string; avatarUrl?: string }) =>
    api.patch<UserProfile>("/me", data).then((r) => r.data),
};

export const beersApi = {
  search: (params: { q?: string; style?: string }) =>
    api.get<BeerSummary[]>("/beers", { params }).then((r) => r.data),
  styles: () => api.get<string[]>("/beers/styles").then((r) => r.data),
  detail: (id: string) => api.get<BeerDetail>(`/beers/${id}`).then((r) => r.data),
  review: (id: string, rating: number, text?: string) =>
    api.post(`/beers/${id}/reviews`, { rating, text }).then((r) => r.data),
};

export const scanApi = {
  scan: (barcode?: string) => api.post<BeerDetail>("/scan", { barcode }).then((r) => r.data),
};

export const barApi = {
  list: () => api.get<BarEntry[]>("/bar").then((r) => r.data),
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
};

export const feedApi = {
  list: () => api.get<FriendPost[]>("/feed").then((r) => r.data),
  create: (text: string, imageUrl?: string) =>
    api.post<FriendPost>("/feed", { text, imageUrl }).then((r) => r.data),
};
