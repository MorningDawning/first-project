import { useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { TAB_BAR_STYLE } from "./tabBarStyle";

/** Прячет нижний таб-бар, пока экран в фокусе (чат, пост с полем ответа и т.п.). */
export function useHideTabBar() {
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      const tabs = navigation.getParent();
      tabs?.setOptions({ tabBarStyle: { display: "none" } });
      return () => tabs?.setOptions({ tabBarStyle: TAB_BAR_STYLE });
    }, [navigation])
  );
}
