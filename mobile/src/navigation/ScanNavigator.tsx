import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ScanStackParamList } from "./types";
import { ScanScreen } from "../screens/scan/ScanScreen";
import { BeerDetailScreen } from "../screens/BeerDetailScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<ScanStackParamList>();

export function ScanNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="ScanHome" component={ScanScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BeerDetail" component={BeerDetailScreen} options={{ title: "" }} />
    </Stack.Navigator>
  );
}
