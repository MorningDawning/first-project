import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LibraryStackParamList } from "./types";
import { LibraryScreen } from "../screens/library/LibraryScreen";
import { BeerDetailScreen } from "../screens/BeerDetailScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export function LibraryNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="LibraryHome" component={LibraryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BeerDetail" component={BeerDetailScreen} options={{ title: "" }} />
    </Stack.Navigator>
  );
}
