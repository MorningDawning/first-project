import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "./types";
import { ScanNavigator } from "./ScanNavigator";
import { LibraryNavigator } from "./LibraryNavigator";
import { BarNavigator } from "./BarNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  ScanTab: "📷",
  LibraryTab: "📚",
  BarTab: "🍻",
  ProfileTab: "👤",
};

const LABELS: Record<keyof MainTabParamList, string> = {
  ScanTab: "Сканер",
  LibraryTab: "Библиотека",
  BarTab: "Бар",
  ProfileTab: "Профиль",
};

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabel: LABELS[route.name as keyof MainTabParamList],
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 20, color }}>{ICONS[route.name as keyof MainTabParamList]}</Text>
        ),
      })}
    >
      <Tab.Screen name="ScanTab" component={ScanNavigator} />
      <Tab.Screen name="LibraryTab" component={LibraryNavigator} />
      <Tab.Screen name="BarTab" component={BarNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}
