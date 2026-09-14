import { Platform } from "react-native";
import Constants from "expo-constants";

const BACKEND_PORT = 4000;

/**
 * Where the BeerVia backend lives.
 *
 * On a physical phone running Expo Go, `localhost` refers to the phone
 * itself, not your computer — so we pull the dev server's LAN IP out of
 * Expo's own connection info (the same IP encoded in the QR code) and talk
 * to the backend there instead. Falls back to emulator/simulator defaults
 * when that's unavailable (e.g. a production build).
 */
function resolveDefaultApiUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  const lanHost = hostUri?.split(":")[0];
  if (lanHost) return `http://${lanHost}:${BACKEND_PORT}`;

  if (Platform.OS === "android") return `http://10.0.2.2:${BACKEND_PORT}`; // Android emulator loopback
  return `http://localhost:${BACKEND_PORT}`; // iOS simulator / web
}

export const API_URL = resolveDefaultApiUrl();
