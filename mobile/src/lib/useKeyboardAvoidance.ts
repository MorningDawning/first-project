import { useEffect, useRef, useState } from "react";
import { Animated, Keyboard, KeyboardEvent, Platform, View } from "react-native";

/**
 * Поднимает содержимое над клавиатурой, как в мессенджерах.
 *
 * Стандартный KeyboardAvoidingView считает нахлёст по координатам внутри
 * родителя и промахивается на высоту шапки и «чёлки»; в новых версиях Android
 * (сквозной режим без изменения размера окна) он не работает вовсе. Здесь
 * нахлёст считается по реальным координатам на экране: низ контейнера против
 * верха клавиатуры.
 *
 * Использование: повесить `ref` и `style` на Animated.View, который тянется на
 * весь экран под шапкой; `keyboardVisible` нужен, чтобы убрать нижний отступ
 * под индикатор «домой», пока клавиатура открыта.
 */
export function useKeyboardAvoidance() {
  const ref = useRef<View>(null);
  const padding = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const apply = (overlap: number, duration?: number) => {
      setKeyboardVisible(overlap > 0);
      Animated.timing(padding, {
        toValue: overlap,
        duration: duration && duration > 0 ? duration : 220,
        useNativeDriver: false,
      }).start();
    };

    const onFrame = (e: KeyboardEvent) => {
      ref.current?.measureInWindow((_x, y, _w, h) => {
        apply(Math.max(0, y + h - e.endCoordinates.screenY), e.duration);
      });
    };

    const subscriptions =
      Platform.OS === "ios"
        ? [Keyboard.addListener("keyboardWillChangeFrame", onFrame)]
        : [Keyboard.addListener("keyboardDidShow", onFrame), Keyboard.addListener("keyboardDidHide", () => apply(0))];

    return () => subscriptions.forEach((s) => s.remove());
  }, [padding]);

  return { ref, style: { paddingBottom: padding }, padding, keyboardVisible };
}
