import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileStackParamList } from "./types";
import { ProfileHomeScreen } from "../screens/profile/ProfileHomeScreen";
import { TasteProfileScreen } from "../screens/profile/TasteProfileScreen";
import { BreweriesScreen } from "../screens/profile/BreweriesScreen";
import { BreweryDetailScreen } from "../screens/profile/BreweryDetailScreen";
import { SettingsScreen } from "../screens/profile/SettingsScreen";
import { FriendsFeedScreen } from "../screens/profile/FriendsFeedScreen";
import { BeerDetailScreen } from "../screens/BeerDetailScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TasteProfile" component={TasteProfileScreen} options={{ title: "Вкусовой профиль" }} />
      <Stack.Screen name="Breweries" component={BreweriesScreen} options={{ title: "Пивоварни мира" }} />
      <Stack.Screen name="BreweryDetail" component={BreweryDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Настройки" }} />
      <Stack.Screen name="FriendsFeed" component={FriendsFeedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BeerDetail" component={BeerDetailScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
