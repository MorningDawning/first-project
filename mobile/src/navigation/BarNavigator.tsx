import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BarStackParamList } from "./types";
import { BarScreen } from "../screens/bar/BarScreen";
import { BeerDetailScreen } from "../screens/BeerDetailScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<BarStackParamList>();

export function BarNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="BarHome" component={BarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BeerDetail" component={BeerDetailScreen} options={{ title: "" }} />
    </Stack.Navigator>
  );
}
