import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { BeerArt } from "../../components/BeerArt";
import { BeerPicker } from "../../components/BeerPicker";
import { Icon } from "../../components/icons/Icon";
import { ErrorView, LoadingView } from "../../components/StateViews";
import { messagesApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { clock, dayLabel, sameDay } from "../../lib/time";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { colors, fonts, matchTint, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { ChatMessage, ChatThread } from "../../types";

type Props = NativeStackScreenProps<FeedStackParamList, "Chat">;

export function ChatScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAvoidance();

  const [thread, setThread] = useState<ChatThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const nearBottom = useRef(true);

  const load = useCallback(async () => {
    try {
      setThread(await messagesApi.thread(userId));
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось открыть чат"));
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      return () => setFocused(false);
    }, [load])
  );

  // Простой опрос вместо соединения в реальном времени: раз в несколько секунд.
  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(load, 4_000);
    return () => clearInterval(timer);
  }, [focused, load]);

  const scrollToBottom = useCallback(() => listRef.current?.scrollToEnd({ animated: false }), []);

  async function send(body: { text?: string; beerId?: string }) {
    if (sending) return;
    setSending(true);
    try {
      await messagesApi.send(userId, body);
      await load();
    } catch (e) {
      Alert.alert("Не отправилось", apiErrorMessage(e));
      throw e;
    } finally {
      setSending(false);
    }
  }

  async function sendText() {
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      await send({ text: body });
    } catch {
      setText(body);
    }
  }

  if (!thread) {
    return error ? <ErrorView message={error} onRetry={load} /> : <LoadingView label="Открываем чат…" />;
  }

  const { peer, canSend, messages } = thread;
  const lastReadOutgoing = [...messages].reverse().find((m) => m.fromMe && m.readAt);
  const status = [peer.online ? "в сети" : null, peer.match != null ? `вкус совпадает на ${peer.match}%` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Pressable onPress={() => navigation.navigate("UserProfile", { userId: peer.id })} style={styles.peer}>
          <Avatar user={peer} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={styles.peerName} numberOfLines={1}>{peer.name}</Text>
            {status ? <Text style={[styles.peerStatus, peer.online && { color: "#56633F" }]} numberOfLines={1}>{status}</Text> : null}
          </View>
        </Pressable>
      </View>

      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
        <FlatList
          ref={listRef}
          // Новое сообщение прокручивает вниз, только если читатель и так был внизу;
          // а когда список сжимается или растягивается под клавиатуру — всегда, чтобы
          // последнее сообщение оставалось перед глазами.
          onContentSizeChange={() => nearBottom.current && scrollToBottom()}
          onLayout={scrollToBottom}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
          }}
          scrollEventThrottle={100}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>Напиши первым — или отправь пиво карточкой</Text>}
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            const newDay = !prev || !sameDay(prev.createdAt, item.createdAt);
            return (
              <View>
                {newDay && (
                  <View style={styles.dayChip}>
                    <Text style={styles.dayChipText}>{dayLabel(item.createdAt)}</Text>
                  </View>
                )}
                <Bubble
                  message={item}
                  peerName={peer.name}
                  onOpenBeer={(beerId) => navigation.navigate("BeerDetail", { beerId })}
                />
                {lastReadOutgoing?.id === item.id && (
                  <Text style={styles.readReceipt}>Прочитано {clock(item.readAt!)}</Text>
                )}
              </View>
            );
          }}
        />

        {canSend ? (
          <View style={[styles.inputBar, { paddingBottom: kb.keyboardVisible ? 12 : Math.max(insets.bottom, 12) }]}>
            <Pressable onPress={() => setPickerOpen(true)} style={styles.attachBtn} hitSlop={6}>
              <Icon name="scan" color="#474238" size={20} strokeWidth={2.75} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Сообщение"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={1000}
            />
            <Pressable
              onPress={sendText}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]}
            >
              <Icon name="arrowUp" color={colors.background} size={20} strokeWidth={2.75} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.locked, { paddingBottom: kb.keyboardVisible ? 12 : Math.max(insets.bottom, 12) }]}>
            <Icon name="lock" color={colors.textMuted} size={16} />
            <Text style={styles.lockedText}>Писать можно только друзьям</Text>
          </View>
        )}
      </Animated.View>

      <BeerPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(beer) => {
          setPickerOpen(false);
          send({ beerId: beer.id }).catch(() => {});
        }}
      />
    </Screen>
  );
}

function Bubble({
  message,
  peerName,
  onOpenBeer,
}: {
  message: ChatMessage;
  peerName: string;
  onOpenBeer: (beerId: string) => void;
}) {
  const mine = message.fromMe;
  const beer = message.beer;
  const tint = beer?.matchForRecipient != null ? matchTint(beer.matchForRecipient) : null;
  const who = mine ? `${peerName.split(" ")[0]}:` : "Тебе:";

  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      {message.text ? (
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, mine && { color: colors.background }]}>{message.text}</Text>
        </View>
      ) : null}
      {beer && (
        <View style={[styles.beerCard, mine ? styles.beerCardMine : styles.beerCardTheirs]}>
          <View style={styles.beerArtBox}>
            <BeerArt name={beer.name} imageUrl={beer.imageUrl} size={78} />
            {tint && beer.matchForRecipient != null && (
              <View style={[styles.beerMatch, { backgroundColor: tint.bg }]}>
                <Text style={[styles.beerMatchText, { color: tint.fg }]}>{who} {beer.matchForRecipient}%</Text>
              </View>
            )}
          </View>
          <View style={{ paddingHorizontal: 4 }}>
            <Text style={styles.beerName} numberOfLines={1}>{beer.name}</Text>
            <Text style={styles.beerSub} numberOfLines={1}>{beer.brewery.name} · {beer.style} · {beer.abv}%</Text>
          </View>
          <Pressable onPress={() => onOpenBeer(beer.id)} style={styles.openBtn}>
            <Text style={styles.openText}>Открыть</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  peer: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  peerName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  peerStatus: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },

  list: { padding: 16, paddingBottom: 8, gap: 8, flexGrow: 1 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: "center", padding: spacing.xl },
  dayChip: { alignSelf: "center", backgroundColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 8 },
  dayChipText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.textMuted },

  bubbleRow: { gap: 8, marginBottom: 2 },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  bubble: { maxWidth: "78%", paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: colors.primary, borderRadius: 22, borderBottomRightRadius: 8 },
  bubbleTheirs: { backgroundColor: colors.card, borderRadius: 22, borderBottomLeftRadius: 8 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  readReceipt: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted, textAlign: "right", paddingRight: 6, marginTop: 2 },

  beerCard: { width: 250, backgroundColor: colors.card, borderRadius: 22, padding: 10, gap: 10, borderWidth: 2 },
  beerCardMine: { borderColor: colors.primary, borderBottomRightRadius: 8 },
  beerCardTheirs: { borderColor: colors.border, borderBottomLeftRadius: 8 },
  beerArtBox: { height: 110, borderRadius: 16, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  beerMatch: { position: "absolute", left: 8, top: 8, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  beerMatchText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  beerName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  beerSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  openBtn: { height: 38, borderRadius: radius.pill, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  openText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },

  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  attachBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, maxHeight: 110, minHeight: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  locked: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  lockedText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textMuted },
});
