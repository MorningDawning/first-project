import React, { useCallback, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { feedApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { FriendPost } from "../../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function FriendsFeedScreen() {
  const [posts, setPosts] = useState<FriendPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await feedApi.list();
      setPosts(data);
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось загрузить ленту"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await feedApi.create(text.trim(), imageUrl.trim() || undefined);
      setText("");
      setImageUrl("");
      await load();
    } catch (e) {
      setError(apiErrorMessage(e, "Не удалось опубликовать пост"));
    } finally {
      setPosting(false);
    }
  }

  const header = (
    <View style={styles.composer}>
      <Text style={styles.title}>Лента друзей</Text>
      <TextField label="Поделитесь находкой" value={text} onChangeText={setText} multiline placeholder="Что попробовали сегодня?" />
      <TextField label="Ссылка на фото (необязательно)" value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" autoCapitalize="none" />
      <Button title="Опубликовать" onPress={handlePost} loading={posting} disabled={!text.trim()} />
    </View>
  );

  if (loading) return <LoadingView label="Загружаем ленту…" />;

  return (
    <Screen>
      <FlatList
        ListHeaderComponent={header}
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={error ? <ErrorView message={error} onRetry={load} /> : <EmptyView emoji="📸" message="Пока нет постов — станьте первым!" />}
        renderItem={({ item }) => (
          <View style={styles.post}>
            <View style={styles.postHeader}>
              {item.user.avatarUrl ? (
                <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{item.user.name[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View>
                <Text style={styles.postUser}>{item.user.name}</Text>
                <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
              </View>
            </View>
            <Text style={styles.postText}>{item.text}</Text>
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.postImage} />}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  composer: { paddingTop: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
  title: { ...typography.title, marginBottom: spacing.xs },
  post: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  postHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700" },
  postUser: { fontWeight: "700", color: colors.text },
  postDate: { ...typography.caption },
  postText: { ...typography.body, marginBottom: spacing.sm },
  postImage: { width: "100%", height: 180, borderRadius: radius.sm },
});
