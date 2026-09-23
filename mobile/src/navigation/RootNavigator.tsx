import React, { useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabNavigator } from "./MainTabNavigator";
import { OnboardingScreen } from "../screens/onboarding/OnboardingScreen";
import { LoadingView } from "../components/StateViews";
import { colors } from "../theme/colors";
import { MainTabParamList } from "./types";

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
  const { isLoading, isAuthenticated, user } = useAuth();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [initialTab, setInitialTab] = useState<keyof MainTabParamList>("HomeTab");

  if (isLoading) return <LoadingView label="Открываем BeerVia…" />;

  // Новый аккаунт без единого отзыва/скана — короткий вкусовой опрос вместо
  // пустого приложения. Пропускается на текущую сессию, как только закрыт.
  const needsOnboarding =
    isAuthenticated &&
    user != null &&
    user.stats.scanCount === 0 &&
    user.stats.reviewCount === 0 &&
    !onboardingDismissed;

  function finishOnboarding(openCamera: boolean) {
    if (openCamera) setInitialTab("CameraTab");
    setOnboardingDismissed(true);
  }

  return (
    <NavigationContainer theme={navTheme}>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : needsOnboarding ? (
        <OnboardingScreen onDone={finishOnboarding} />
      ) : (
        <MainTabNavigator initialRouteName={initialTab} />
      )}
    </NavigationContainer>
  );
}
