import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeStackParamList } from "./types";
import { HomeScreen } from "../screens/scan/HomeScreen";
import { LibraryScreen } from "../screens/library/LibraryScreen";
import { BeerDetailScreen } from "../screens/BeerDetailScreen";
import { AddBeerScreen } from "../screens/scan/AddBeerScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Catalog" component={LibraryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BeerDetail" component={BeerDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddBeer" component={AddBeerScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
