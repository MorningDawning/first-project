import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { BeerCard } from "../../components/BeerCard";
import { scanApi, beersApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { ScanStackParamList } from "../../navigation/types";
import { BeerSummary } from "../../types";

type Nav = NativeStackNavigationProp<ScanStackParamList, "ScanHome">;

export function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<BeerSummary[]>([]);

  useEffect(() => {
    beersApi
      .search({})
      .then((beers) => {
        const withMatch = beers.filter((b) => b.matchPercent != null);
        withMatch.sort((a, b) => (b.matchPercent ?? 0) - (a.matchPercent ?? 0));
        setRecommendations(withMatch.slice(0, 4));
      })
      .catch(() => {});
  }, []);

  async function handleScan() {
    setError(null);
    setScanning(true);
    try {
      // Имитация распознавания этикетки/банки — в реальном приложении здесь
      // фото/кадр с камеры отправляется на сервис компьютерного зрения.
      await new Promise((resolve) => setTimeout(resolve, 900));
      const beer = await scanApi.scan();
      navigation.navigate("BeerDetail", { beerId: beer.id });
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось распознать пиво"));
    } finally {
      setScanning(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Сканер</Text>
        <Text style={styles.subtitle}>Наведите камеру на банку или этикетку пива</Text>
      </View>

      <View style={styles.cameraWrap}>
        {!permission ? null : !permission.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Нужен доступ к камере, чтобы сканировать пиво</Text>
            <Button title="Разрешить доступ" onPress={requestPermission} />
          </View>
        ) : (
          <View style={styles.cameraFrame}>
            <CameraView style={styles.camera} facing="back" />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
            </View>
          </View>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        <Button
          title={scanning ? "Распознаём…" : "Сканировать"}
          onPress={handleScan}
          loading={scanning}
          disabled={!permission?.granted}
        />
      </View>

      {recommendations.length > 0 && (
        <View style={styles.recs}>
          <Text style={styles.sectionTitle}>Рекомендуем по вашему вкусу</Text>
          {recommendations.map((b) => (
            <BeerCard
              key={b.id}
              name={b.name}
              style={b.style}
              breweryName={b.brewery.name}
              imageUrl={b.imageUrl}
              matchPercent={b.matchPercent}
              onPress={() => navigation.navigate("BeerDetail", { beerId: b.id })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: 0 },
  title: { ...typography.title },
  subtitle: { ...typography.caption, marginTop: 2 },
  cameraWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  permissionBox: {
    height: 220,
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
  cameraFrame: { height: 260, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" },
  camera: { flex: 1 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  frame: { width: "60%", height: "55%", borderWidth: 3, borderColor: colors.accent, borderRadius: radius.md },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.sm },
  footer: { padding: spacing.lg },
  recs: { paddingHorizontal: spacing.lg },
  sectionTitle: { ...typography.heading, marginBottom: spacing.sm },
});
