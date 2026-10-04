import React from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./icons/Icon";
import { resolveMediaUrl } from "../api/config";

/** Фото на весь экран: тап по фону или по крестику закрывает. */
export function ImageViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Modal visible={url !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {url && <Image source={{ uri: resolveMediaUrl(url) ?? undefined }} style={styles.image} resizeMode="contain" />}
        <SafeAreaView style={styles.top} edges={["top"]} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Icon name="close" color="#fff" size={20} strokeWidth={2.75} />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center" },
  image: { width: "100%", height: "80%" },
  top: { position: "absolute", top: 0, right: 0, padding: 16 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
});
