import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { scanApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { ScanStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<ScanStackParamList, "Camera">;

export function CameraScanScreen() {
  const navigation = useNavigation<Nav>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture() {
    if (!cameraRef.current) return;
    setError(null);
    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo) throw new Error("Не удалось сделать снимок");
      const beer = await scanApi.scan(photo.uri);
      // Заменяем экран камеры карточкой пива, чтобы «Назад» вело на Главную, а не обратно на камеру.
      navigation.replace("BeerDetail", { beerId: beer.id });
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось распознать пиво"));
    } finally {
      setScanning(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Сканирование</Text>
        <Text style={styles.subtitle}>Наведите камеру на этикетку и сделайте снимок</Text>
      </View>

      <View style={styles.cameraWrap}>
        {!permission ? null : !permission.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Нужен доступ к камере, чтобы сканировать пиво</Text>
            <Button title="Разрешить доступ" onPress={requestPermission} />
          </View>
        ) : (
          <View style={styles.cameraFrame}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
            </View>
          </View>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        <Button
          title={scanning ? "Распознаём…" : "Сделать снимок"}
          onPress={handleCapture}
          loading={scanning}
          disabled={!permission?.granted}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: 0 },
  title: { ...typography.title },
  subtitle: { ...typography.caption, marginTop: 2 },
  cameraWrap: { flex: 1, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  permissionBox: {
    height: 260,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  permissionText: { ...typography.body, textAlign: "center" },
  cameraFrame: { flex: 1, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" },
  camera: { flex: 1 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  frame: { width: "70%", height: "45%", borderWidth: 3, borderColor: colors.accent, borderRadius: radius.md },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.sm },
  footer: { padding: spacing.lg },
});
