import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "./icons/Icon";
import { toggleVoice, useVoiceState } from "../lib/voicePlayer";
import { formatDuration } from "../lib/time";
import { colors, fonts } from "../theme/colors";

const BARS = 30;

/** Столбики волны выводим из id сообщения: у каждой записи свой, но стабильный рисунок. */
function waveform(id: string): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  return Array.from({ length: BARS }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return 0.25 + (seed / 0xffffffff) * 0.75;
  });
}

/** Голосовое сообщение: кнопка «играть», волна с прогрессом и время. */
export function VoiceBubble({ id, url, durationMs, mine }: { id: string; url: string; durationMs: number; mine: boolean }) {
  const state = useVoiceState(id);
  const bars = useMemo(() => waveform(id), [id]);
  const total = state.duration > 0 ? state.duration * 1000 : durationMs;
  const progress = total > 0 ? Math.min(1, (state.position * 1000) / total) : 0;
  const started = state.playing || state.position > 0;

  const fg = mine ? colors.background : colors.text;
  const dim = mine ? "rgba(251,243,231,0.4)" : "#CFC3AE";
  const lit = mine ? colors.background : colors.primary;

  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Pressable
        onPress={() => toggleVoice(id, url, durationMs).catch(() => {})}
        style={[styles.play, { backgroundColor: mine ? colors.background : colors.primary }]}
        hitSlop={6}
      >
        <Icon
          name={state.playing ? "pause" : "play"}
          color={mine ? colors.primary : colors.background}
          size={18}
          filled
          strokeWidth={1}
        />
      </Pressable>
      <View style={styles.wave}>
        {bars.map((h, i) => (
          <View
            key={i}
            style={{
              width: 3,
              borderRadius: 2,
              height: 4 + h * 20,
              backgroundColor: i / BARS < progress ? lit : dim,
            }}
          />
        ))}
      </View>
      <Text style={[styles.time, { color: fg }]}>{formatDuration(started ? state.position * 1000 : durationMs)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, width: 250 },
  mine: { backgroundColor: colors.primary, borderRadius: 22, borderBottomRightRadius: 8 },
  theirs: { backgroundColor: colors.card, borderRadius: 22, borderBottomLeftRadius: 8 },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  wave: { flex: 1, height: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { fontFamily: fonts.bodySemiBold, fontSize: 13, minWidth: 34, textAlign: "right" },
});
