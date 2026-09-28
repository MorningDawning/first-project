import React from "react";
import { StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "./types";
import { HomeNavigator } from "./HomeNavigator";
import { LibraryNavigator } from "./LibraryNavigator";
import { BarNavigator } from "./BarNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { CameraScanScreen } from "../screens/scan/CameraScanScreen";
import { BarIcon, CameraIcon, HomeIcon, IconProps, LibraryIcon, ProfileIcon } from "../components/icons/TabIcons";
import { colors, fonts } from "../theme/colors";

const Tab = createBottomTabNavigator<MainTabParamList>();

type RegularTabName = Exclude<keyof MainTabParamList, "CameraTab">;

const ICONS: Record<RegularTabName, (props: IconProps) => React.JSX.Element> = {
  HomeTab: HomeIcon,
  LibraryTab: LibraryIcon,
  BarTab: BarIcon,
  ProfileTab: ProfileIcon,
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
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarLabel: LABELS[route.name as RegularTabName],
        tabBarIcon: ({ color }) => {
          const Icon = ICONS[route.name as RegularTabName];
          return <Icon color={color} size={24} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeNavigator} />
      <Tab.Screen name="LibraryTab" component={LibraryNavigator} />
      <Tab.Screen
        name="CameraTab"
        component={CameraScanScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.cameraBadge}>
              <CameraIcon color="#fff" size={26} />
            </View>
          ),
        }}
      />
      <Tab.Screen name="BarTab" component={BarNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 88,
    paddingTop: 10,
    backgroundColor: colors.card,
    borderTopColor: colors.border,
  },
  tabBarLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  cameraBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    marginTop: -28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: colors.background,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
});
