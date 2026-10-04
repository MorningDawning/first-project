import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

export type PickedImage = { uri: string; width: number; height: number };

/** Фото из галереи или с камеры; при отказе в доступе объясняет, что делать. null — если человек передумал. */
export async function pickImage(source: "library" | "camera"): Promise<PickedImage | null> {
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Нет доступа к камере", "Разрешите доступ к камере в настройках телефона.");
      return null;
    }
    result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Нет доступа к фото", "Разрешите доступ к галерее в настройках телефона.");
      return null;
    }
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  }
  if (result.canceled || !result.assets[0]) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
}
