import { useCallback, useEffect, useRef, useState } from "react";
import {
  RecordingOptions,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { stopVoice } from "./voicePlayer";

/**
 * Для голоса хватает моно и 48 кбит/с: минута записи — около 350 КБ.
 * На Android берём AAC в m4a (а не 3gp/AMR из LOW_QUALITY), иначе iPhone такую запись не проиграет.
 */
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 48000,
  isMeteringEnabled: true,
  android: { extension: ".m4a", outputFormat: "mpeg4", audioEncoder: "aac" },
};

export const MAX_VOICE_MS = 5 * 60_000;
const MIN_VOICE_MS = 600;
const LEVELS = 28;

export type Recorded = { uri: string; durationMs: number };

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 100);
  const [active, setActive] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const startedAt = useRef(0);

  // Уровень громкости для живых «столбиков» во время записи.
  useEffect(() => {
    if (!active || state.metering === undefined) return;
    const level = Math.min(1, Math.max(0.06, (state.metering + 60) / 60));
    setLevels((prev) => [...prev.slice(-(LEVELS - 1)), level]);
  }, [active, state.metering, state.durationMillis]);

  /** Возвращает null, если нет доступа к микрофону. */
  const start = useCallback(async (): Promise<"ok" | "denied" | "error"> => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return "denied";
      stopVoice();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setLevels([]);
      setActive(true);
      return "ok";
    } catch {
      return "error";
    }
  }, [recorder]);

  const release = useCallback(async () => {
    setActive(false);
    // Вернуть звук на основной динамик (при записи iPhone переключается на разговорный).
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  }, []);

  /** Остановить и вернуть файл. Слишком короткие записи (случайный тап) отбрасываем. */
  const finish = useCallback(async (): Promise<Recorded | null> => {
    const durationMs = Date.now() - startedAt.current;
    try {
      await recorder.stop();
    } catch {
      /* уже остановлена */
    }
    const uri = recorder.uri;
    await release();
    if (!uri || durationMs < MIN_VOICE_MS) return null;
    return { uri, durationMs: Math.min(durationMs, MAX_VOICE_MS) };
  }, [recorder, release]);

  const cancel = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      /* уже остановлена */
    }
    await release();
  }, [recorder, release]);

  return { active, durationMs: active ? Date.now() - startedAt.current : 0, tick: state.durationMillis, levels, start, finish, cancel };
}
