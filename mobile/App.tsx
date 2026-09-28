import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Caprasimo_400Regular } from "@expo-google-fonts/caprasimo";
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  // useFonts возвращает [loaded, error] — раньше мы читали только loaded,
  // и при ошибке загрузки шрифтов (а не просто "ещё грузится") приложение
  // навсегда зависало на пустом экране без единого намёка на причину.
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontError) console.error("Не удалось загрузить шрифты:", fontError);
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <RootNavigator />
        </View>
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
