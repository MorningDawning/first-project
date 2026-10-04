import { useSyncExternalStore } from "react";
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { resolveMediaUrl } from "../api/config";

/**
 * Один общий плеер на всё приложение: включаешь новое голосовое — предыдущее замолкает,
 * как в мессенджерах. Состояние отдаём подписчикам через useSyncExternalStore.
 */

export type VoiceState = { playing: boolean; position: number; duration: number };

const IDLE: VoiceState = { playing: false, position: 0, duration: 0 };

let player: AudioPlayer | null = null;
let activeId: string | null = null;
let active: VoiceState = IDLE;
const listeners = new Set<() => void>();

function emit(next: VoiceState) {
  active = next;
  listeners.forEach((l) => l());
}

function ensurePlayer(): AudioPlayer {
  if (player) return player;
  player = createAudioPlayer(null, { updateInterval: 100 });
  player.addListener("playbackStatusUpdate", (status) => {
    if (!activeId) return;
    if (status.didJustFinish) {
      // Дослушали: возвращаем в начало, чтобы следующий тап играл заново.
      player?.pause();
      player?.seekTo(0).catch(() => {});
      emit({ playing: false, position: 0, duration: status.duration || active.duration });
      return;
    }
    emit({ playing: status.playing, position: status.currentTime, duration: status.duration || active.duration });
  });
  return player;
}

/** Включить голосовое или поставить на паузу, если оно уже играет. */
export async function toggleVoice(id: string, url: string, knownDurationMs: number) {
  const p = ensurePlayer();
  if (activeId === id) {
    if (p.playing) p.pause();
    else p.play();
    return;
  }
  // Запись только что могла идти — возвращаем звук на динамик и разрешаем играть при выключенном звуке.
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
  activeId = id;
  emit({ playing: false, position: 0, duration: knownDurationMs / 1000 });
  p.replace({ uri: resolveMediaUrl(url) ?? url });
  p.play();
}

export function stopVoice() {
  player?.pause();
  activeId = null;
  emit(IDLE);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Состояние воспроизведения именно этого голосового (для остальных — покой). */
export function useVoiceState(id: string): VoiceState {
  const snapshot = useSyncExternalStore(subscribe, () => (activeId === id ? active : IDLE));
  return snapshot;
}
