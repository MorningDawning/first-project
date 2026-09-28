import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FeedStackParamList } from "./types";
import { FeedScreen } from "../screens/feed/FeedScreen";
import { PostDetailScreen } from "../screens/feed/PostDetailScreen";
import { ComposeScreen } from "../screens/feed/ComposeScreen";
import { UserProfileScreen } from "../screens/feed/UserProfileScreen";
import { FriendRequestsScreen } from "../screens/feed/FriendRequestsScreen";
import { DialogsScreen } from "../screens/feed/DialogsScreen";
import { ChatScreen } from "../screens/feed/ChatScreen";
import { NewMessageScreen } from "../screens/feed/NewMessageScreen";
import { BeerDetailScreen } from "../screens/BeerDetailScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<FeedStackParamList>();

export function FeedNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="FeedHome" component={FeedScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="Compose" component={ComposeScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="FriendRequests" component={FriendRequestsScreen} />
      <Stack.Screen name="Dialogs" component={DialogsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} />
      <Stack.Screen name="BeerDetail" component={BeerDetailScreen} />
    </Stack.Navigator>
  );
}
