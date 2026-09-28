import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Catalog: { style?: string; focusSearch?: boolean } | undefined;
  BeerDetail: { beerId: string };
};

export type FeedStackParamList = {
  FeedHome: undefined;
  PostDetail: { postId: string };
  Compose: { beerId?: string } | undefined;
  UserProfile: { userId: string };
  FriendRequests: undefined;
  Dialogs: undefined;
  Chat: { userId: string };
  NewMessage: undefined;
  BeerDetail: { beerId: string };
};

export type BarStackParamList = {
  BarHome: undefined;
  BeerDetail: { beerId: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  TasteProfile: undefined;
  Breweries: undefined;
  BreweryDetail: { breweryId: string };
  Settings: undefined;
  BeerDetail: { beerId: string };
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  FeedTab: NavigatorScreenParams<FeedStackParamList>;
  BarTab: NavigatorScreenParams<BarStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
  CameraTab: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
