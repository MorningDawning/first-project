import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "./types";
import { HomeNavigator } from "./HomeNavigator";
import { LibraryNavigator } from "./LibraryNavigator";
import { BarNavigator } from "./BarNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { CameraScanScreen } from "../screens/scan/CameraScanScreen";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator<MainTabParamList>();

type RegularTabName = Exclude<keyof MainTabParamList, "CameraTab">;

const ICONS: Record<RegularTabName, string> = {
  HomeTab: "🏠",
  LibraryTab: "📚",
  BarTab: "🍻",
  ProfileTab: "👤",
};

const LABELS: Record<RegularTabName, string> = {
  HomeTab: "Главная",
  LibraryTab: "Библиотека",
  BarTab: "Бар",
  ProfileTab: "Профиль",
};

type Props = { initialRouteName?: keyof MainTabParamList };

export function MainTabNavigator({ initialRouteName }: Props) {
  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabel: LABELS[route.name as RegularTabName],
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 20, color }}>{ICONS[route.name as RegularTabName]}</Text>
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeNavigator} />
      <Tab.Screen name="LibraryTab" component={LibraryNavigator} />
      <Tab.Screen name="BarTab" component={BarNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} />
      <Tab.Screen
        name="CameraTab"
        component={CameraScanScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.cameraBadge}>
              <Text style={styles.cameraBadgeIcon}>📷</Text>
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  cameraBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginTop: -14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  cameraBadgeIcon: { fontSize: 20 },
});
