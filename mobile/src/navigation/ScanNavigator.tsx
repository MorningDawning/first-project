import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ScanStackParamList } from "./types";
import { HomeScreen } from "../screens/scan/HomeScreen";
import { CameraScanScreen } from "../screens/scan/CameraScanScreen";
import { BeerDetailScreen } from "../screens/BeerDetailScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<ScanStackParamList>();

export function ScanNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Camera" component={CameraScanScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BeerDetail" component={BeerDetailScreen} options={{ title: "" }} />
    </Stack.Navigator>
  );
}
