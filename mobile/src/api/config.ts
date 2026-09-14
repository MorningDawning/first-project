import { Platform } from "react-native";

/**
 * Where the BeerVia backend lives. Override by setting `extra.apiUrl` in
 * app.json (e.g. your machine's LAN IP when testing on a physical phone via
 * Expo Go — localhost on the phone is the phone itself, not your computer).
 */
function resolveDefaultApiUrl(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:4000"; // Android emulator loopback
  return "http://localhost:4000"; // iOS simulator / web
}

export const API_URL = resolveDefaultApiUrl();
