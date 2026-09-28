import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FeedStackParamList } from "./types";
import { FeedScreen } from "../screens/feed/FeedScreen";
import { BeerDetailScreen } from "../screens/BeerDetailScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<FeedStackParamList>();

export function FeedNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="FeedHome" component={FeedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BeerDetail" component={BeerDetailScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
