import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type ScanStackParamList = {
  ScanHome: undefined;
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
  ScanTab: NavigatorScreenParams<ScanStackParamList>;
  LibraryTab: NavigatorScreenParams<LibraryStackParamList>;
  BarTab: NavigatorScreenParams<BarStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
