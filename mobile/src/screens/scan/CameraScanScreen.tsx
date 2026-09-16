import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Button } from "../../components/Button";
import { scanApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";
import { ScanStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<ScanStackParamList, "Camera">;

export function CameraScanScreen() {
  const navigation = useNavigation<Nav>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPhoto(uri: string) {
    setError(null);
    setScanning(true);
    try {
      const beer = await scanApi.scan(uri);
      // Заменяем экран камеры карточкой пива, чтобы «Назад» вело на Главную, а не обратно на камеру.
      navigation.replace("BeerDetail", { beerId: beer.id });
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось распознать пиво"));
    } finally {
      setScanning(false);
    }
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    if (!photo) {
      setError("Не удалось сделать снимок");
      return;
    }
    await submitPhoto(photo.uri);
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await submitPhoto(result.assets[0].uri);
    }
  }

  return (
    <View style={styles.root}>
      {permission?.granted && (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      )}

      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <RoundIconButton icon="✕" onPress={() => navigation.goBack()} />
          {permission?.granted && (
            <RoundIconButton icon={torch ? "⚡️" : "⚡"} active={torch} onPress={() => setTorch((t) => !t)} />
          )}
        </View>

        {!permission ? null : !permission.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Нужен доступ к камере, чтобы сканировать пиво</Text>
            <Button title="Разрешить доступ" variant="light" onPress={requestPermission} />
          </View>
        ) : (
          <View style={styles.viewfinderWrap} pointerEvents="none">
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>
        )}

        <View style={styles.bottomArea}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.controlsRow}>
            <RoundIconButton icon="🖼️" onPress={handlePickFromGallery} disabled={scanning} />
            <Pressable
              onPress={handleCapture}
              disabled={!permission?.granted || scanning}
              style={({ pressed }) => [
                styles.shutter,
                (pressed || scanning) && styles.shutterActive,
                !permission?.granted && styles.shutterDisabled,
              ]}
            >
              {scanning && <View style={styles.shutterSpinnerRing} />}
            </Pressable>
            <View style={styles.controlsSpacer} />
          </View>

          <View style={styles.hintSheet}>
            <View style={styles.hintHandle} />
            <Text style={styles.hintText}>
              {scanning ? "Распознаём этикетку…" : "Держите банку ровно в кадре, на весь видоискатель"}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function RoundIconButton({
  icon,
  onPress,
  active,
  disabled,
}: {
  icon: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.roundButton,
        active && styles.roundButtonActive,
        pressed && styles.roundButtonPressed,
        disabled && styles.roundButtonDisabled,
      ]}
    >
      <Text style={styles.roundButtonIcon}>{icon}</Text>
    </Pressable>
  );
}

const SHUTTER_SIZE = 74;
const CORNER_SIZE = 32;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, justifyContent: "space-between" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },

  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonActive: { backgroundColor: colors.accent },
  roundButtonPressed: { opacity: 0.7 },
  roundButtonDisabled: { opacity: 0.4 },
  roundButtonIcon: { fontSize: 18, color: "#fff" },

  permissionBox: {
    marginHorizontal: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  permissionText: { color: "#fff", fontSize: 15, textAlign: "center" },

  viewfinderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewfinder: { width: "72%", aspectRatio: 0.85 },
  corner: { position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE, borderColor: colors.accent },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: radius.md },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: radius.md },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: radius.md },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: radius.md },

  bottomArea: { gap: spacing.md, paddingBottom: spacing.sm },

  errorBanner: { marginHorizontal: spacing.lg, backgroundColor: "rgba(192,57,43,0.9)", borderRadius: radius.sm, padding: spacing.sm },
  errorText: { color: "#fff", textAlign: "center", fontSize: 13 },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
  },
  controlsSpacer: { width: 40, height: 40 },

  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterActive: { backgroundColor: colors.accent },
  shutterDisabled: { opacity: 0.4 },
  shutterSpinnerRing: {
    width: SHUTTER_SIZE - 20,
    height: SHUTTER_SIZE - 20,
    borderRadius: (SHUTTER_SIZE - 20) / 2,
    borderWidth: 3,
    borderColor: colors.primary,
  },

  hintSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  hintHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.xs },
  hintText: { color: colors.text, fontSize: 13, textAlign: "center" },
});
