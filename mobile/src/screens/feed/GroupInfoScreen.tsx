import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BackButton } from "../../components/BackButton";
import { GroupAvatar } from "../../components/GroupAvatar";
import { Icon } from "../../components/icons/Icon";
import { ErrorView, LoadingView } from "../../components/StateViews";
import { useAuth } from "../../context/AuthContext";
import { chatsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { plural } from "../../lib/time";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";
import { ChatInfo, ChatMemberInfo } from "../../types";

type Props = NativeStackScreenProps<FeedStackParamList, "GroupInfo">;

export function GroupInfoScreen({ route, navigation }: Props) {
  const { chatId } = route.params;
  const { user: me } = useAuth();
  const [chat, setChat] = useState<ChatInfo | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const thread = await chatsApi.thread(chatId);
      setChat(thread.chat);
      setTitle(thread.chat.title);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось открыть группу"));
    }
  }, [chatId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!chat) return error ? <ErrorView message={error} onRetry={load} /> : <LoadingView />;

  const isOwner = chat.myRole === "owner";
  const titleChanged = title.trim() !== chat.title && title.trim().length > 0;

  async function saveTitle() {
    setSaving(true);
    try {
      await chatsApi.rename(chatId, title.trim());
      await load();
    } catch (e) {
      Alert.alert("Не получилось", apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function memberMenu(member: ChatMemberInfo) {
    if (!isOwner || member.id === me?.id) return;
    Alert.alert(member.name, undefined, [
      {
        text: "Убрать из группы",
        style: "destructive",
        onPress: () =>
          chatsApi
            .removeMember(chatId, member.id)
            .then(load)
            .catch((e) => Alert.alert("Не получилось", apiErrorMessage(e))),
      },
      { text: "Отмена", style: "cancel" },
    ]);
  }

  function leave() {
    Alert.alert("Выйти из группы?", "Переписка пропадёт из твоих чатов.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Выйти",
        style: "destructive",
        onPress: async () => {
          try {
            await chatsApi.removeMember(chatId, me!.id);
            navigation.navigate("Dialogs");
          } catch (e) {
            Alert.alert("Не получилось", apiErrorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.heading}>О группе</Text>
      </View>

      <FlatList
        data={chat.members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.head}>
            <GroupAvatar id={chat.id} size={88} />
            {isOwner ? (
              <View style={styles.titleEdit}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  style={styles.titleInput}
                  maxLength={60}
                  placeholder="Название группы"
                  placeholderTextColor={colors.textMuted}
                />
                {titleChanged && (
                  <Pressable onPress={saveTitle} style={styles.saveBtn} disabled={saving}>
                    {saving ? <ActivityIndicator color={colors.background} size="small" /> : <Icon name="check" color={colors.background} size={18} strokeWidth={3} />}
                  </Pressable>
                )}
              </View>
            ) : (
              <Text style={styles.titleText}>{chat.title}</Text>
            )}
            <Text style={styles.count}>
              {chat.members.length} {plural(chat.members.length, "участник", "участника", "участников")}
            </Text>

            <Pressable
              onPress={() => navigation.navigate("NewGroup", { addTo: chatId, exclude: chat.members.map((m) => m.id) })}
              style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.addIcon}>
                <Icon name="userPlus" color={colors.background} size={20} />
              </View>
              <Text style={styles.addText}>Добавить участников</Text>
              <Icon name="chevronRight" color={colors.textMuted} size={18} strokeWidth={2.75} />
            </Pressable>
          </View>
        }
        ListFooterComponent={
          <Pressable onPress={leave} style={({ pressed }) => [styles.leave, pressed && { opacity: 0.85 }]}>
            <Icon name="logout" color={colors.danger} size={18} />
            <Text style={styles.leaveText}>Выйти из группы</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => (item.id === me?.id ? undefined : navigation.navigate("UserProfile", { userId: item.id }))}
            onLongPress={() => memberMenu(item)}
            style={({ pressed }) => [styles.member, pressed && { opacity: 0.85 }]}
          >
            <View>
              <Avatar user={item} size={44} me={item.id === me?.id} />
              {item.online && <View style={styles.onlineDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {item.username ? (
                <Text style={styles.username}>@{item.username}{item.id === me?.id ? " · это ты" : ""}</Text>
              ) : null}
            </View>
            {item.role === "owner" && (
              <View style={styles.ownerChip}>
                <Text style={styles.ownerText}>создатель</Text>
              </View>
            )}
            {isOwner && item.id !== me?.id && (
              <Pressable onPress={() => memberMenu(item)} hitSlop={8}>
                <Icon name="dots" color={colors.textMuted} size={20} />
              </Pressable>
            )}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingTop: 6 },
  heading: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  list: { padding: spacing.lg, gap: 8, paddingBottom: spacing.xl * 2 },
  head: { alignItems: "center", gap: 10, paddingBottom: spacing.md },
  titleEdit: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "stretch", justifyContent: "center" },
  titleInput: { flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: 24, color: colors.text, paddingVertical: 4 },
  saveBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  titleText: { fontFamily: fonts.display, fontSize: 24, color: colors.text, textAlign: "center" },
  count: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  addRow: { alignSelf: "stretch", marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 22, padding: 10 },
  addIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  addText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  member: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 22, padding: 10 },
  onlineDot: { position: "absolute", right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: "#7A8A5E", borderWidth: 3, borderColor: colors.card },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  username: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  ownerChip: { backgroundColor: "#E1EECC", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  ownerText: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#3D472B" },
  leave: { marginTop: spacing.lg, height: 52, borderRadius: radius.pill, borderWidth: 2, borderColor: "#F0C9C3", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  leaveText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.danger },
});
