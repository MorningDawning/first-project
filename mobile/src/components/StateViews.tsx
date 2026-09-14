import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme/colors";
import { Button } from "./Button";

export function LoadingView({ label = "Загрузка…" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>😕</Text>
      <Text style={styles.label}>{message}</Text>
      {onRetry && <Button title="Повторить" variant="outline" onPress={onRetry} style={{ marginTop: spacing.md }} />}
    </View>
  );
}

export function EmptyView({ emoji = "🍺", message }: { emoji?: string; message: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.label}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: 15, textAlign: "center", marginTop: spacing.sm },
  emoji: { fontSize: 40 },
});
