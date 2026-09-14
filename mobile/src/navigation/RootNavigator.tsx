import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabNavigator } from "./MainTabNavigator";
import { LoadingView } from "../components/StateViews";
import { colors } from "../theme/colors";

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

export function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <LoadingView label="Открываем BeerVia…" />;

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
