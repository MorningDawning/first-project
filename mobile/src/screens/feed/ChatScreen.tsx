import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Image, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { AttachSheet } from "../../components/AttachSheet";
import { BackButton } from "../../components/BackButton";
import { BeerArt } from "../../components/BeerArt";
import { BeerPicker } from "../../components/BeerPicker";
import { GroupAvatar } from "../../components/GroupAvatar";
import { ImageViewer } from "../../components/ImageViewer";
import { VoiceBubble } from "../../components/VoiceBubble";
import { Icon } from "../../components/icons/Icon";
import { ErrorView, LoadingView } from "../../components/StateViews";
import { useAuth } from "../../context/AuthContext";
import { chatsApi, OutgoingMessage, uploadsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { resolveMediaUrl } from "../../api/config";
import { clock, dayLabel, formatDuration, plural, sameDay } from "../../lib/time";
import { pickImage } from "../../lib/pickImage";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { MAX_VOICE_MS, useVoiceRecorder } from "../../lib/useVoiceRecorder";
import { stopVoice } from "../../lib/voicePlayer";
import { useRealtimeConnected, useRealtimeEvents, useRealtimeSend } from "../../lib/realtime";
import { colors, fonts, matchTint, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { ChatMessage, ChatThread, MessageQuote, UserBrief } from "../../types";

type Props = NativeStackScreenProps<FeedStackParamList, "Chat">;

type Pending = { id: string; uri: string; width: number; height: number; caption: string };
type TypingMap = Record<string, { name: string; until: number }>;

const NAME_COLORS = ["#B2622D", "#3D6B4A", "#5B6FA8", "#A8557A", "#8A6F2C", "#2F7F86"];
const TYPING_TTL = 5_000;

function nameColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function photoSize(width: number | null, height: number | null) {
  const MAX_W = 240;
  const MAX_H = 320;
  if (!width || !height) return { width: MAX_W, height: MAX_W };
  const ratio = width / height;
  let w = MAX_W;
  let h = w / ratio;
  if (h > MAX_H) {
    h = MAX_H;
    w = h * ratio;
  }
  return { width: Math.max(120, w), height: Math.max(120, h) };
}

/** Подряд идущие сообщения одного человека склеиваем в «серию» — имя и аватар показываем один раз. */
function sameRun(a?: ChatMessage, b?: ChatMessage): boolean {
  if (!a || !b || a.kind !== "user" || b.kind !== "user" || a.sender.id !== b.sender.id) return false;
  if (!sameDay(a.createdAt, b.createdAt)) return false;
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000;
}

function typingLabel(names: string[]): string {
  const first = names.map((n) => n.split(" ")[0]);
  if (first.length === 0) return "";
  if (first.length === 1) return `${first[0]} печатает…`;
  if (first.length === 2) return `${first[0]} и ${first[1]} печатают…`;
  return "Печатают несколько человек…";
}

export function ChatScreen({ route, navigation }: Props) {
  const { chatId } = route.params;
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAvoidance();
  const sendRealtime = useRealtimeSend();
  const connected = useRealtimeConnected();
  const { user: me } = useAuth();

  const [thread, setThread] = useState<ChatThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [typing, setTyping] = useState<TypingMap>({});
  const [beerPickerOpen, setBeerPickerOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [voiceSending, setVoiceSending] = useState(false);
  const recorder = useVoiceRecorder();
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const replyRef = useRef<ChatMessage | null>(null);
  replyRef.current = replyTo;

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const nearBottom = useRef(true);
  const justSent = useRef(false);
  // Пока идёт отправка, держимся у конца списка, даже если прокрутка «не успела»:
  // список растёт (фото-заглушка, потом настоящее сообщение), а отметка «внизу» отстаёт.
  const stickUntil = useRef(0);
  const lastTypingSent = useRef(0);

  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await chatsApi.thread(chatId);
      if (firstLoad.current) {
        // Длинная переписка дорисовывается порциями и её высота уточняется по ходу:
        // пока идёт первая отрисовка, держимся у конца, а не сдаёмся на первой же недокрутке.
        firstLoad.current = false;
        stickUntil.current = Date.now() + 1_500;
        nearBottom.current = true;
      }
      setThread(data);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось открыть чат"));
    }
  }, [chatId]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      return () => {
        setFocused(false);
        stopVoice();
      };
    }, [load])
  );

  // Ушли с экрана посреди записи — запись отбрасываем.
  useEffect(
    () => () => {
      if (recorderRef.current.active) recorderRef.current.cancel();
    },
    []
  );

  // Живые события: новое сообщение, «прочитано», «печатает…», изменение состава.
  useRealtimeEvents((event) => {
    if (event.chatId !== chatId || !focused) return;
    if (event.type === "typing") {
      setTyping((prev) => ({ ...prev, [event.userId]: { name: event.name, until: Date.now() + TYPING_TTL } }));
    } else if (event.type === "message") {
      setTyping((prev) => {
        if (!(event.fromId in prev)) return prev;
        const { [event.fromId]: _gone, ...rest } = prev;
        return rest;
      });
      load();
    } else {
      load();
    }
  });

  // Запасной опрос на случай, если соединение оборвалось.
  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(load, connected ? 20_000 : 4_000);
    return () => clearInterval(timer);
  }, [focused, connected, load]);

  // «Печатает…» гаснет само, если человек замолчал.
  const anyTyping = Object.keys(typing).length > 0;
  useEffect(() => {
    if (!anyTyping) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1_000);
    return () => clearInterval(timer);
  }, [anyTyping]);

  // К концу едем по реальным размерам, которые сообщает сам список (содержимое минус видимая часть),
  // а не через scrollToEnd: он опирается на прикидочные замеры строк и не доезжает, когда высота
  // меняется на ходу (пузырь «печатает…», подпись «Прочитано», подгрузка фото).
  const contentH = useRef(0);
  const viewH = useRef(0);
  const scrollEnd = useCallback((animated: boolean) => {
    listRef.current?.scrollToOffset({ offset: Math.max(0, contentH.current - viewH.current), animated });
  }, []);

  async function deliver(message: OutgoingMessage) {
    const reply = replyRef.current;
    await chatsApi.send(chatId, { ...message, replyToId: reply?.id });
    if (reply) setReplyTo((cur) => (cur?.id === reply.id ? null : cur));
    stickUntil.current = Date.now() + 2_000;
    // Как в Telegram: своё сообщение всегда возвращает к концу переписки,
    // даже если до этого пролистал вверх искать старое.
    nearBottom.current = true;
    justSent.current = true;
    await load();
  }

  async function send(message: OutgoingMessage) {
    if (sending) return;
    setSending(true);
    try {
      await deliver(message);
    } catch (e) {
      Alert.alert("Не отправилось", apiErrorMessage(e));
      throw e;
    } finally {
      setSending(false);
    }
  }

  async function sendText() {
    const body = text.trim();
    if (editing) return saveEdit(body);
    if (!body) return;
    setText("");
    try {
      await send({ text: body });
    } catch {
      setText(body);
    }
  }

  async function saveEdit(body: string) {
    if (!editing || sending) return;
    if (!body && !editing.photo && !editing.beer) return;
    const target = editing;
    setSending(true);
    try {
      if (body !== (target.text ?? "")) await chatsApi.editMessage(chatId, target.id, body);
      setEditing(null);
      setText("");
      await load();
    } catch (e) {
      Alert.alert("Не удалось изменить", apiErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  function startReply(message: ChatMessage) {
    setEditing(null);
    setReplyTo(message);
  }

  function startEdit(message: ChatMessage) {
    setReplyTo(null);
    setEditing(message);
    setText(message.text ?? "");
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  function confirmDelete(message: ChatMessage) {
    Alert.alert("Удалить сообщение?", "Оно исчезнет у всех участников чата.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await chatsApi.deleteMessage(chatId, message.id);
            if (replyRef.current?.id === message.id) setReplyTo(null);
            if (editing?.id === message.id) cancelEdit();
            await load();
          } catch (e) {
            Alert.alert("Не удалось удалить", apiErrorMessage(e));
          }
        },
      },
    ]);
  }

  /** Тап по цитате: прокрутить к исходному сообщению и на секунду подсветить его. */
  function jumpTo(messageId: string) {
    const index = thread?.messages.findIndex((m) => m.id === messageId) ?? -1;
    if (index < 0) return;
    nearBottom.current = false;
    stickUntil.current = 0;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((cur) => (cur === messageId ? null : cur)), 1_400);
  }

  // ----- голосовые -----

  async function startRecording() {
    Keyboard.dismiss();
    const result = await recorder.start();
    if (result === "denied") Alert.alert("Нет доступа к микрофону", "Разрешите доступ к микрофону в настройках телефона.");
    else if (result === "error") Alert.alert("Не удалось начать запись", "Попробуйте ещё раз.");
  }

  async function sendVoice() {
    const recorded = await recorder.finish();
    if (!recorded) return;
    setVoiceSending(true);
    nearBottom.current = true;
    stickUntil.current = Date.now() + 3_000;
    try {
      const url = await uploadsApi.audio(recorded.uri);
      await deliver({ audio: { url, durationMs: recorded.durationMs } });
    } catch (e) {
      Alert.alert("Голосовое не отправилось", apiErrorMessage(e));
    } finally {
      stickUntil.current = Date.now() + 1_500;
      setVoiceSending(false);
    }
  }

  // Лимит длины записи: дошли до конца — отправляем сами.
  useEffect(() => {
    if (recorder.active && recorder.durationMs >= MAX_VOICE_MS) sendVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.tick]);

  function onChangeText(value: string) {
    setText(value);
    if (value.trim() && Date.now() - lastTypingSent.current > 2_500) {
      lastTypingSent.current = Date.now();
      sendRealtime({ type: "typing", chatId });
    }
  }

  async function pickPhoto(source: "library" | "camera") {
    const asset = await pickImage(source);
    if (!asset) return;

    // Написанный в поле текст становится подписью к фото.
    const caption = text.trim();
    setText("");
    const id = `${Date.now()}`;
    nearBottom.current = true;
    stickUntil.current = Date.now() + 3_000;
    setPending((p) => [...p, { id, uri: asset.uri, width: asset.width, height: asset.height, caption }]);
    try {
      const url = await uploadsApi.photo(asset.uri);
      await deliver({ text: caption || undefined, photo: { url, width: asset.width, height: asset.height } });
    } catch (e) {
      Alert.alert("Фото не отправилось", apiErrorMessage(e));
      if (caption) setText(caption);
    } finally {
      stickUntil.current = Date.now() + 1_500;
      setPending((p) => p.filter((x) => x.id !== id));
    }
  }

  const attachOptions = useMemo(
    () => [
      { key: "beer", label: "Пиво", icon: "scan" as const, onPress: () => setBeerPickerOpen(true) },
      { key: "library", label: "Фото из галереи", icon: "image" as const, onPress: () => pickPhoto("library") },
      { key: "camera", label: "Сделать фото", icon: "camera" as const, onPress: () => pickPhoto("camera") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, chatId]
  );

  const menuOptions = menuFor
    ? [
        { key: "reply", label: "Ответить", icon: "reply" as const, onPress: () => startReply(menuFor) },
        ...(menuFor.fromMe && !menuFor.audio
          ? [{ key: "edit", label: "Изменить", icon: "pencil" as const, onPress: () => startEdit(menuFor) }]
          : []),
        ...(menuFor.fromMe
          ? [{ key: "delete", label: "Удалить у всех", icon: "trash" as const, onPress: () => confirmDelete(menuFor) }]
          : []),
      ]
    : [];

  if (!thread) {
    return error ? <ErrorView message={error} onRetry={load} /> : <LoadingView label="Открываем чат…" />;
  }

  const { chat, messages } = thread;
  const isGroup = chat.type === "group";
  const typingNames = Object.values(typing).map((t) => t.name);
  const typingUser: UserBrief | undefined = (() => {
    const id = Object.keys(typing)[0];
    return id ? chat.members.find((m) => m.id === id) : undefined;
  })();
  const lastReadOwn = [...messages].reverse().find((m) => m.fromMe && (chat.type === "direct" ? m.readAt : m.readBy > 0));

  const onlineOthers = chat.members.filter((m) => m.online && m.id !== me?.id).length;
  const status = typingNames.length
    ? typingLabel(typingNames)
    : isGroup
      ? `${chat.members.length} ${plural(chat.members.length, "участник", "участника", "участников")}${onlineOthers > 0 ? ` · ${onlineOthers} в сети` : ""}`
      : [chat.peer?.online ? "в сети" : null, chat.peer?.match != null ? `вкус совпадает на ${chat.peer.match}%` : null]
          .filter(Boolean)
          .join(" · ");

  function openHeader() {
    if (isGroup) navigation.navigate("GroupInfo", { chatId });
    else if (chat.peer) navigation.navigate("UserProfile", { userId: chat.peer.id });
  }

  const footer = (
    <View style={{ gap: 8 }}>
      {pending.map((p) => {
        const size = photoSize(p.width, p.height);
        return (
          <View key={p.id} style={styles.rowMine}>
            <View style={[styles.photoWrap, size]}>
              <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} />
              <View style={styles.photoBusy}>
                <ActivityIndicator color="#fff" />
              </View>
            </View>
          </View>
        );
      })}
      {voiceSending && (
        <View style={styles.rowMine}>
          <View style={styles.voicePending}>
            <ActivityIndicator color={colors.background} size="small" />
            <Text style={styles.voicePendingText}>Отправляем голосовое…</Text>
          </View>
        </View>
      )}
      {typingNames.length > 0 && (
        <View style={styles.typingRow}>
          {isGroup && <View style={styles.avatarSlot}>{typingUser && <Avatar user={typingUser} size={28} />}</View>}
          <TypingBubble />
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Pressable onPress={openHeader} style={styles.peer}>
          {isGroup ? <GroupAvatar id={chat.id} size={42} /> : chat.peer && <Avatar user={chat.peer} size={42} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.peerName} numberOfLines={1}>{chat.title}</Text>
            {status ? (
              <Text
                style={[styles.peerStatus, (typingNames.length > 0 || (!isGroup && chat.peer?.online)) && { color: "#56633F" }]}
                numberOfLines={1}
              >
                {status}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>

      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          // В чате не больше сотни сообщений — рисуем их все сразу. Иначе список подставляет
          // «прикидочную» высоту невидимых строк, и прокрутка к концу каждый раз не доезжает.
          initialNumToRender={100}
          maxToRenderPerBatch={100}
          windowSize={31}
          // Новое сообщение прокручивает вниз, только если читатель и так был внизу;
          // а когда список сжимается или растягивается под клавиатуру — всегда, чтобы
          // последнее сообщение оставалось перед глазами.
          onContentSizeChange={(_w, h) => {
            contentH.current = h;
            if (!nearBottom.current && Date.now() > stickUntil.current) return;
            scrollEnd(justSent.current);
            justSent.current = false;
          }}
          onLayout={(e) => {
            viewH.current = e.nativeEvent.layout.height;
            scrollEnd(false);
          }}
          onScroll={(e) => {
            if (Date.now() < stickUntil.current) return;
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
          }}
          scrollEventThrottle={100}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.4, animated: true }), 350);
          }}
          ListEmptyComponent={<Text style={styles.empty}>Напиши первым, отправь фото или пиво карточкой</Text>}
          ListFooterComponent={footer}
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const newDay = !prev || !sameDay(prev.createdAt, item.createdAt);
            return (
              <View style={highlightId === item.id && styles.highlight}>
                {newDay && (
                  <View style={styles.dayChip}>
                    <Text style={styles.dayChipText}>{dayLabel(item.createdAt)}</Text>
                  </View>
                )}
                <MessageRow
                  message={item}
                  isGroup={isGroup}
                  peerName={chat.peer?.name ?? ""}
                  startsRun={!sameRun(prev, item)}
                  endsRun={!sameRun(item, next)}
                  onOpenBeer={(beerId) => navigation.navigate("BeerDetail", { beerId })}
                  onOpenPhoto={setViewerUrl}
                  onOpenUser={(userId) => navigation.navigate("UserProfile", { userId })}
                  onLongPress={chat.canSend ? () => setMenuFor(item) : undefined}
                  onOpenQuote={jumpTo}
                />
                {lastReadOwn?.id === item.id && (
                  <Text style={styles.readReceipt}>
                    {chat.type === "direct"
                      ? `Прочитано ${clock(item.readAt!)}`
                      : `Прочитано: ${item.readBy} из ${chat.otherCount}`}
                  </Text>
                )}
              </View>
            );
          }}
        />

        {chat.canSend ? (
          <View style={[styles.composer, { paddingBottom: kb.keyboardVisible ? 12 : Math.max(insets.bottom, 12) }]}>
            {(replyTo || editing) && (
              <View style={styles.contextBar}>
                <View style={styles.contextAccent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contextTitle} numberOfLines={1}>
                    {editing ? "Изменение сообщения" : `Ответ: ${replyTo!.fromMe ? "себе" : replyTo!.sender.name.split(" ")[0]}`}
                  </Text>
                  <Text style={styles.contextText} numberOfLines={1}>{previewOf(editing ?? replyTo!)}</Text>
                </View>
                <Pressable onPress={editing ? cancelEdit : () => setReplyTo(null)} hitSlop={10}>
                  <Icon name="close" color={colors.textMuted} size={18} />
                </Pressable>
              </View>
            )}
            {recorder.active ? (
              <View style={styles.inputBar}>
                <Pressable onPress={recorder.cancel} style={styles.attachBtn} hitSlop={6}>
                  <Icon name="trash" color={colors.danger} size={20} />
                </Pressable>
                <View style={styles.recordPill}>
                  <RecordingDot />
                  <Text style={styles.recordTime}>{formatDuration(recorder.durationMs)}</Text>
                  <View style={styles.levels}>
                    {recorder.levels.map((l, i) => (
                      <View key={i} style={{ width: 3, borderRadius: 2, height: 4 + l * 22, backgroundColor: colors.primary }} />
                    ))}
                  </View>
                </View>
                <Pressable onPress={sendVoice} style={styles.sendBtn}>
                  <Icon name="arrowUp" color={colors.background} size={20} strokeWidth={2.75} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.inputBar}>
                {!editing && (
                  <Pressable onPress={() => setAttachOpen(true)} style={styles.attachBtn} hitSlop={6}>
                    <Icon name="plus" color="#474238" size={22} strokeWidth={2.75} />
                  </Pressable>
                )}
                <TextInput
                  value={text}
                  onChangeText={onChangeText}
                  placeholder="Сообщение"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  multiline
                  maxLength={1000}
                />
                {text.trim() || editing ? (
                  <Pressable
                    onPress={sendText}
                    disabled={sending || (!!editing && !text.trim() && !editing.photo && !editing.beer)}
                    style={[styles.sendBtn, (sending || (!!editing && !text.trim() && !editing.photo && !editing.beer)) && { opacity: 0.45 }]}
                  >
                    <Icon name={editing ? "check" : "arrowUp"} color={colors.background} size={20} strokeWidth={2.75} />
                  </Pressable>
                ) : (
                  <Pressable onPress={startRecording} disabled={voiceSending} style={[styles.sendBtn, voiceSending && { opacity: 0.45 }]}>
                    <Icon name="mic" color={colors.background} size={20} strokeWidth={2.4} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.locked, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Icon name="lock" color={colors.textMuted} size={16} />
            <Text style={styles.lockedText}>Писать можно только друзьям</Text>
          </View>
        )}
      </Animated.View>

      <AttachSheet visible={attachOpen} options={attachOptions} onClose={() => setAttachOpen(false)} />
      <AttachSheet visible={menuFor !== null} options={menuOptions} onClose={() => setMenuFor(null)} />
      <BeerPicker
        visible={beerPickerOpen}
        onClose={() => setBeerPickerOpen(false)}
        onPick={(beer) => {
          setBeerPickerOpen(false);
          send({ beerId: beer.id }).catch(() => {});
        }}
      />
      <ImageViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
    </Screen>
  );
}

function TypingBubble() {
  const dots = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View style={styles.typingBubble}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.typingDot, { opacity: d }]} />
      ))}
    </View>
  );
}

/** Короткое описание сообщения для полосы «ответ / изменение». */
function previewOf(m: ChatMessage): string {
  if (m.text) return m.text;
  if (m.audio) return "Голосовое сообщение";
  if (m.photo) return "Фото";
  if (m.beer) return `Пиво: ${m.beer.name}`;
  return "Сообщение";
}

function quoteLabel(q: MessageQuote): string {
  if (q.deleted) return "Сообщение удалено";
  if (q.text) return q.text;
  if (q.kind === "voice") return "Голосовое сообщение";
  if (q.kind === "photo") return "Фото";
  if (q.kind === "beer") return `Пиво: ${q.beerName ?? ""}`;
  return "Сообщение";
}

function RecordingDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.recDot, { opacity }]} />;
}

function QuoteBlock({ quote, mine, inside, onPress }: { quote: MessageQuote; mine: boolean; inside: boolean; onPress: () => void }) {
  const onDark = mine && inside; // внутри своего оранжевого пузыря
  return (
    <Pressable
      onPress={onPress}
      style={[styles.quote, inside ? (onDark ? styles.quoteOnMine : styles.quoteOnTheirs) : styles.quoteStandalone]}
    >
      <View style={[styles.quoteBar, { backgroundColor: onDark ? colors.background : colors.primary }]} />
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.quoteName, { color: onDark ? colors.background : colors.primary }]} numberOfLines={1}>
          {quote.senderName}
        </Text>
        <Text
          style={[styles.quoteText, { color: onDark ? "rgba(251,243,231,0.85)" : colors.textMuted }, quote.deleted && { fontStyle: "italic" }]}
          numberOfLines={2}
        >
          {quoteLabel(quote)}
        </Text>
      </View>
    </Pressable>
  );
}

function MessageRow({
  message,
  isGroup,
  peerName,
  startsRun,
  endsRun,
  onOpenBeer,
  onOpenPhoto,
  onOpenUser,
  onLongPress,
  onOpenQuote,
}: {
  message: ChatMessage;
  isGroup: boolean;
  peerName: string;
  startsRun: boolean;
  endsRun: boolean;
  onOpenBeer: (beerId: string) => void;
  onOpenPhoto: (url: string) => void;
  onOpenUser: (userId: string) => void;
  onLongPress?: () => void;
  onOpenQuote: (messageId: string) => void;
}) {
  if (message.kind === "system") {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    );
  }

  const mine = message.fromMe;
  const { beer, photo } = message;
  const tint = beer?.match != null ? matchTint(beer.match) : null;
  const who = beer?.matchWho === "peer" ? `${peerName.split(" ")[0]}:` : "Тебе:";
  const showSideAvatar = isGroup && !mine;

  return (
    <View style={[styles.messageLine, mine ? styles.lineMine : styles.lineTheirs, !startsRun && { marginTop: -4 }]}>
      {showSideAvatar && (
        <View style={styles.avatarSlot}>
          {endsRun && (
            <Pressable onPress={() => onOpenUser(message.sender.id)}>
              <Avatar user={message.sender} size={28} />
            </Pressable>
          )}
        </View>
      )}
      <Pressable
        onLongPress={message.deleted ? undefined : onLongPress}
        delayLongPress={320}
        style={[styles.column, mine ? styles.rowMine : styles.rowTheirs]}
      >
        {showSideAvatar && startsRun && (
          <Text style={[styles.senderName, { color: nameColor(message.sender.id) }]}>{message.sender.name}</Text>
        )}

        {message.deleted && (
          <View style={styles.deletedBubble}>
            <Text style={styles.deletedText}>Сообщение удалено</Text>
          </View>
        )}

        {message.replyTo && !message.text && (
          <QuoteBlock quote={message.replyTo} mine={mine} inside={false} onPress={() => onOpenQuote(message.replyTo!.id)} />
        )}

        {message.audio && <VoiceBubble id={message.id} url={message.audio.url} durationMs={message.audio.durationMs} mine={mine} />}

        {photo && (
          <Pressable onPress={() => onOpenPhoto(photo.url)} onLongPress={onLongPress} delayLongPress={320} style={[styles.photoWrap, photoSize(photo.width, photo.height)]}>
            <Image source={{ uri: resolveMediaUrl(photo.url) ?? undefined }} style={StyleSheet.absoluteFill} />
          </Pressable>
        )}

        {message.text ? (
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            {message.replyTo && (
              <QuoteBlock quote={message.replyTo} mine={mine} inside onPress={() => onOpenQuote(message.replyTo!.id)} />
            )}
            <Text style={[styles.bubbleText, mine && { color: colors.background }]}>
              {message.text}
              {message.editedAt ? <Text style={[styles.edited, mine && { color: "rgba(251,243,231,0.7)" }]}>{"  изменено"}</Text> : null}
            </Text>
          </View>
        ) : null}

        {beer && (
          <View style={[styles.beerCard, mine ? styles.beerCardMine : styles.beerCardTheirs]}>
            <View style={styles.beerArtBox}>
              <BeerArt name={beer.name} imageUrl={beer.imageUrl} size={78} />
              {tint && beer.match != null && (
                <View style={[styles.beerMatch, { backgroundColor: tint.bg }]}>
                  <Text style={[styles.beerMatchText, { color: tint.fg }]}>{who} {beer.match}%</Text>
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
      </Pressable>
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
  systemRow: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 24 },
  systemText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.textMuted, textAlign: "center" },

  messageLine: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  lineMine: { justifyContent: "flex-end" },
  lineTheirs: { justifyContent: "flex-start" },
  avatarSlot: { width: 28, height: 28 },
  column: { gap: 6, maxWidth: "82%" },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  senderName: { fontFamily: fonts.bodyBold, fontSize: 12, paddingLeft: 6 },
  bubble: { paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: colors.primary, borderRadius: 22, borderBottomRightRadius: 8 },
  bubbleTheirs: { backgroundColor: colors.card, borderRadius: 22, borderBottomLeftRadius: 8 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  readReceipt: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted, textAlign: "right", paddingRight: 6, marginTop: 2 },

  photoWrap: { borderRadius: 20, overflow: "hidden", backgroundColor: colors.border },
  photoBusy: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,.35)", alignItems: "center", justifyContent: "center" },

  typingRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  typingBubble: { flexDirection: "row", gap: 4, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 13 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#A19786" },

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

  composer: { borderTopWidth: 0 },
  contextBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  contextAccent: { width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: colors.primary },
  contextTitle: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.primary },
  contextText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 1 },

  recordPill: { flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, overflow: "hidden" },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recordTime: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, minWidth: 38 },
  levels: { flex: 1, height: 30, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2, overflow: "hidden" },
  voicePending: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16 },
  voicePendingText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.background },

  highlight: { backgroundColor: "rgba(232,163,61,0.22)", borderRadius: 16 },
  edited: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
  deletedBubble: { borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", borderRadius: 22, paddingVertical: 10, paddingHorizontal: 14 },
  deletedText: { fontFamily: fonts.bodyMedium, fontSize: 14, fontStyle: "italic", color: colors.textMuted },

  quote: { flexDirection: "row", gap: 8, borderRadius: 12, paddingVertical: 6, paddingRight: 10, paddingLeft: 8, marginBottom: 6, alignSelf: "stretch" },
  quoteOnMine: { backgroundColor: "rgba(251,243,231,0.16)" },
  quoteOnTheirs: { backgroundColor: "rgba(216,90,48,0.09)" },
  quoteStandalone: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 0, maxWidth: 250 },
  quoteBar: { width: 3, borderRadius: 2 },
  quoteName: { fontFamily: fonts.bodyBold, fontSize: 12 },
  quoteText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },

  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  attachBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, maxHeight: 110, minHeight: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  locked: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  lockedText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textMuted },
});
