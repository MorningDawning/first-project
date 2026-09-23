import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  BeerDetail: { beerId: string };
};

export type LibraryStackParamList = {
  LibraryHome: undefined;
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
  FriendsFeed: undefined;
  BeerDetail: { beerId: string };
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  LibraryTab: NavigatorScreenParams<LibraryStackParamList>;
  BarTab: NavigatorScreenParams<BarStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
  CameraTab: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
