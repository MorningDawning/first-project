import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Catalog: { style?: string; focusSearch?: boolean } | undefined;
  BeerDetail: { beerId: string; scanned?: boolean };
  AddBeer: { barcode?: string; name?: string } | undefined;
};

export type FeedStackParamList = {
  FeedHome: undefined;
  PostDetail: { postId: string };
  Compose: { beerId?: string } | undefined;
  UserProfile: { userId: string };
  FriendRequests: undefined;
  PeopleSearch: undefined;
  Dialogs: undefined;
  Chat: { chatId: string };
  NewMessage: { shareBeerId?: string } | undefined;
  NewGroup: { addTo?: string; exclude?: string[] } | undefined;
  GroupInfo: { chatId: string };
  BeerDetail: { beerId: string; scanned?: boolean };
};

export type BarStackParamList = {
  BarHome: undefined;
  BeerDetail: { beerId: string; scanned?: boolean };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  TasteProfile: undefined;
  Breweries: undefined;
  BreweryDetail: { breweryId: string };
  Settings: undefined;
  BeerDetail: { beerId: string; scanned?: boolean };
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
