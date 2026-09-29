import React, { useRef, useState } from "react";
import axios from "axios";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Button } from "../../components/Button";
import { MatchRing } from "../../components/MatchRing";
import { scanApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { MainTabParamList } from "../../navigation/types";
import { BeerDetail } from "../../types";

type Nav = BottomTabNavigationProp<MainTabParamList, "CameraTab">;

/** Сервер ответил «такого пива нет» (а не «что-то сломалось»). */
function isNotRecognized(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.data?.code === "NOT_RECOGNIZED";
}

export function CameraScanScreen() {
  const navigation = useNavigation<Nav>();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<BeerDetail | null>(null);
  // Пиво не нашли: показываем предложение найти вручную или добавить (barcode — если сканировали штрихкод).
  const [notFound, setNotFound] = useState<{ barcode: string | null } | null>(null);
  const lastBarcode = useRef<{ code: string; at: number } | null>(null);
  // Останавливаем рендер CameraView сразу после съёмки/выбора фото, не дожидаясь
  // навигации — иначе нативная камера-сессия иногда остаётся «висеть» в фоне
  // (iOS показывает системную плашку «вернуться к камере» поверх других экранов).
  // Также следим за фокусом вкладки: камера теперь отдельная вкладка таббара и
  // остаётся смонтированной при переходе на другие вкладки, так что без этого
  // объектив продолжал бы работать в фоне.
  const [cameraActive, setCameraActive] = useState(true);
  const cameraVisible = cameraActive && isFocused && !found && !notFound;

  async function submitPhoto(uri: string) {
    setError(null);
    setScanning(true);
    try {
      const beer = await scanApi.scan(uri);
      // Показываем мини-карточку с результатом прямо здесь — переход на
      // карточку пива только по явному тапу «Открыть».
      setFound(beer);
    } catch (e) {
      if (isNotRecognized(e)) setNotFound({ barcode: null });
      else {
        setError(apiErrorMessage(e, "Не удалось распознать пиво"));
        setCameraActive(true);
      }
    } finally {
      setScanning(false);
    }
  }

  // Штрихкод камера ловит сама, без нажатия на кнопку. Один и тот же код не обрабатываем чаще раза в 3 секунды.
  async function onBarcode(code: string) {
    if (scanning || found || notFound) return;
    const last = lastBarcode.current;
    if (last && last.code === code && Date.now() - last.at < 3_000) return;
    lastBarcode.current = { code, at: Date.now() };
    setError(null);
    setScanning(true);
    try {
      setFound(await scanApi.scanBarcode(code));
    } catch (e) {
      if (isNotRecognized(e)) setNotFound({ barcode: code });
      else setError(apiErrorMessage(e, "Не удалось найти пиво по штрихкоду"));
    } finally {
      setScanning(false);
    }
  }

  function openFound() {
    if (!found) return;
    const beerId = found.id;
    setFound(null);
    setCameraActive(true);
    // Результат показываем во вкладке «Главная», а не поверх камеры — так вкладка
    // «Скан» остаётся отдельным инструментом, а «Назад» с карточки ведёт на Главную.
    navigation.navigate("HomeTab", { screen: "BeerDetail", params: { beerId } });
  }

  function scanAgain() {
    setFound(null);
    setNotFound(null);
    setError(null);
    setCameraActive(true);
  }

  function addBeer() {
    const barcode = notFound?.barcode ?? undefined;
    scanAgain();
    navigation.navigate("HomeTab", { screen: "AddBeer", params: { barcode } });
  }

  function searchCatalog() {
    scanAgain();
    navigation.navigate("HomeTab", { screen: "Catalog", params: { focusSearch: true } });
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    setCameraActive(false);
    if (!photo) {
      setError("Не удалось сделать снимок");
      return;
    }
    await submitPhoto(photo.uri);
  }

  async function handlePickFromGallery() {
    setCameraActive(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await submitPhoto(result.assets[0].uri);
    } else {
      setCameraActive(true);
    }
  }

  return (
    <View style={styles.root}>
      {permission?.granted && cameraVisible && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
          onBarcodeScanned={scanning ? undefined : (result) => onBarcode(result.data)}
        />
      )}

      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <RoundIconButton icon="✕" onPress={() => navigation.navigate("HomeTab", { screen: "Home" })} />
          {permission?.granted && !found && !notFound && (
            <RoundIconButton icon={torch ? "⚡️" : "⚡"} active={torch} onPress={() => setTorch((t) => !t)} />
          )}
        </View>

        {!permission ? null : !permission.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Нужен доступ к камере, чтобы сканировать пиво</Text>
            <Button title="Разрешить доступ" variant="light" onPress={requestPermission} />
          </View>
        ) : (
          !found &&
          !notFound && (
            <View style={styles.viewfinderWrap} pointerEvents="none">
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
            </View>
          )
        )}

        {notFound ? (
          <View style={styles.bottomArea}>
            <View style={styles.notFoundCard}>
              <Text style={styles.notFoundTitle}>Не нашли это пиво</Text>
              <Text style={styles.notFoundText}>
                {notFound.barcode
                  ? `Штрихкода ${notFound.barcode} пока нет в базе. Найдите пиво вручную или добавьте его: в следующий раз скан узнает эту банку.`
                  : "По фото не удалось узнать этикетку. Попробуйте навести камеру на штрихкод, найти пиво вручную или добавить его."}
              </Text>
              <Button title="Добавить пиво" onPress={addBeer} />
              <Button title="Найти в каталоге" variant="outline" onPress={searchCatalog} />
            </View>
            <Pressable onPress={scanAgain} hitSlop={8}>
              <Text style={styles.scanAgain}>Сканировать ещё раз</Text>
            </Pressable>
          </View>
        ) : found ? (
          <View style={styles.bottomArea}>
            <Pressable onPress={openFound} style={styles.foundCard}>
              <MatchRing percent={found.matchPercent ?? 0} size={52} strokeWidth={5}>
                <Text style={styles.foundRingText}>{found.matchPercent ?? "–"}%</Text>
              </MatchRing>
              <View style={styles.foundInfo}>
                <Text style={styles.foundName} numberOfLines={1}>{found.name}</Text>
                <Text style={styles.foundMeta} numberOfLines={1}>{found.brewery.name} · {found.style}</Text>
              </View>
              <View style={styles.foundOpenBtn}>
                <Text style={styles.foundOpenText}>Открыть</Text>
              </View>
            </Pressable>
            <Pressable onPress={scanAgain} hitSlop={8}>
              <Text style={styles.scanAgain}>Сканировать ещё раз</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.bottomArea}>
            <View style={[styles.hintPill, error && styles.hintPillError]}>
              <Text style={styles.hintText}>
                {error ?? (scanning ? "Ищем пиво…" : "Наведите на штрихкод или сфотографируйте этикетку")}
              </Text>
            </View>

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
              <RoundIconButton
                icon="🕘"
                onPress={() => navigation.navigate("BarTab", { screen: "BarHome" })}
                disabled={scanning}
              />
            </View>
          </View>
        )}
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
const CORNER_SIZE = 44;
const CORNER_THICKNESS = 5;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1F1C19" },
  overlay: { flex: 1, justifyContent: "space-between" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },

  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(245,234,216,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonActive: { backgroundColor: colors.accent },
  roundButtonPressed: { opacity: 0.7 },
  roundButtonDisabled: { opacity: 0.4 },
  roundButtonIcon: { fontSize: 18, lineHeight: 20, color: "#fff", textAlign: "center" },

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
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 26 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 26 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 26 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 26 },

  bottomArea: { gap: spacing.lg, paddingBottom: spacing.md, alignItems: "center" },

  hintPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    maxWidth: "85%",
  },
  hintPillError: { backgroundColor: "rgba(192,57,43,0.85)" },
  hintText: { color: "#fff", fontSize: 13, textAlign: "center" },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    alignSelf: "stretch",
  },

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

  notFoundCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm + 2,
    alignSelf: "stretch",
  },
  notFoundTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  notFoundText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },

  foundCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.sm + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    alignSelf: "stretch",
  },
  foundRingText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  foundInfo: { flex: 1, gap: 2 },
  foundName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  foundMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  foundOpenBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  foundOpenText: { fontFamily: fonts.display, fontSize: 15, color: colors.background },
  scanAgain: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "rgba(245,234,216,0.8)" },
});
