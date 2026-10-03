import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { BeerArt } from "../../components/BeerArt";
import { BeerPicker, PickedBeer } from "../../components/BeerPicker";
import { StarRating } from "../../components/StarRating";
import { Icon, IconName } from "../../components/icons/Icon";
import { useAuth } from "../../context/AuthContext";
import { beersApi, feedApi, uploadsApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { FeedStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<FeedStackParamList, "Compose">;
type Visibility = "friends" | "all";
type Photo = { key: string; uri: string; url: string | null };

const MAX_PHOTOS = 3;

export function ComposeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<FeedStackParamList, "Compose">>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAvoidance();
  const textRef = useRef<TextInput>(null);

  const [text, setText] = useState("");
  const [beer, setBeer] = useState<PickedBeer | null>(null);
  const [rating, setRating] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showPlace, setShowPlace] = useState(false);
  const [place, setPlace] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => textRef.current?.focus(), 450);
    return () => clearTimeout(timer);
  }, []);

  const initialBeerId = route.params?.beerId;
  useEffect(() => {
    if (!initialBeerId) return;
    beersApi
      .detail(initialBeerId)
      .then((b) => setBeer({ id: b.id, name: b.name, style: b.style, imageUrl: b.imageUrl, brewery: { name: b.brewery.name } }))
      .catch(() => {});
  }, [initialBeerId]);

  const uploading = photos.some((p) => p.url === null);
  const canPublish = text.trim().length > 0 && !uploading && !publishing;

  async function addPhoto() {
    if (photos.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Нет доступа к фото", "Разрешите доступ к галерее в настройках телефона.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
    });
    if (result.canceled) return;

    for (const asset of result.assets.slice(0, MAX_PHOTOS - photos.length)) {
      const key = `${Date.now()}-${Math.random()}`;
      setPhotos((prev) => [...prev, { key, uri: asset.uri, url: null }]);
      uploadsApi
        .photo(asset.uri)
        .then((url) => setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, url } : p))))
        .catch((e) => {
          setPhotos((prev) => prev.filter((p) => p.key !== key));
          Alert.alert("Фото не загрузилось", apiErrorMessage(e));
        });
    }
  }

  function chooseVisibility() {
    Alert.alert("Кто видит пост", undefined, [
      { text: "Друзья", onPress: () => setVisibility("friends") },
      { text: "Все — попадёт в «Для тебя»", onPress: () => setVisibility("all") },
      { text: "Отмена", style: "cancel" },
    ]);
  }

  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    try {
      await feedApi.create({
        text: text.trim(),
        beerId: beer?.id,
        rating: beer && rating > 0 ? rating : undefined,
        place: place.trim() || undefined,
        visibility,
        photos: photos.map((p) => p.url!).filter(Boolean),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Не получилось опубликовать", apiErrorMessage(e));
      setPublishing(false);
    }
  }

  function cancel() {
    if (text.trim() || beer || photos.length > 0) {
      Alert.alert("Отменить пост?", "Написанное пропадёт.", [
        { text: "Продолжить", style: "cancel" },
        { text: "Отменить", style: "destructive", onPress: () => navigation.goBack() },
      ]);
      return;
    }
    navigation.goBack();
  }

  const tools: { key: string; label: string; icon: IconName; onPress: () => void; active: boolean }[] = [
    { key: "beer", label: "Пиво", icon: "scan", onPress: () => setPickerOpen(true), active: beer !== null },
    { key: "photo", label: "Фото", icon: "image", onPress: addPhoto, active: photos.length > 0 },
    { key: "place", label: "Место", icon: "pin", onPress: () => setShowPlace((v) => !v), active: showPlace || place.length > 0 },
  ];

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={cancel} hitSlop={8}>
          <Text style={styles.cancel}>Отмена</Text>
        </Pressable>
        <Text style={styles.topTitle}>Новый пост</Text>
        <Pressable onPress={publish} disabled={!canPublish} style={[styles.publish, !canPublish && { opacity: 0.45 }]}>
          {publishing ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={styles.publishText}>Опубликовать</Text>}
        </Pressable>
      </View>

      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.authorRow}>
            {user && <Avatar user={user} size={44} me />}
            <View>
              <Text style={styles.authorName}>{user?.name}</Text>
              <Pressable onPress={chooseVisibility} style={styles.visibility}>
                <Text style={styles.visibilityText}>Видят: {visibility === "friends" ? "друзья" : "все"} ▾</Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            ref={textRef}
            value={text}
            onChangeText={setText}
            placeholder="Что пьёшь сегодня?"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={500}
          />

          {beer && (
            <View style={styles.beerCard}>
              <View style={styles.beerRow}>
                <BeerArt name={beer.name} imageUrl={beer.imageUrl} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.beerName} numberOfLines={1}>{beer.name}</Text>
                  <Text style={styles.beerSub} numberOfLines={1}>{beer.brewery.name} · {beer.style}</Text>
                </View>
                <Pressable onPress={() => { setBeer(null); setRating(0); }} hitSlop={8} style={styles.removeBtn}>
                  <Icon name="close" color="#474238" size={14} strokeWidth={3} />
                </Pressable>
              </View>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Моя оценка</Text>
                <StarRating rating={rating} onChange={setRating} size={26} emptyColor="#B9AE9B" />
              </View>
              {rating > 0 && <Text style={styles.ratingHint}>Оценка сохранится и в твоих отзывах о пиве</Text>}
            </View>
          )}

          {photos.length > 0 && (
            <View style={styles.photoRow}>
              {photos.map((p) => (
                <View key={p.key} style={styles.photoTile}>
                  <Image source={{ uri: p.uri }} style={styles.photoImage} />
                  {p.url === null && (
                    <View style={styles.photoBusy}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                  <Pressable
                    onPress={() => setPhotos((prev) => prev.filter((x) => x.key !== p.key))}
                    hitSlop={6}
                    style={styles.photoRemove}
                  >
                    <Icon name="close" color="#fff" size={12} strokeWidth={3} />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable onPress={addPhoto} style={[styles.photoTile, styles.photoAdd]}>
                  <Icon name="plus" color={colors.textMuted} size={24} strokeWidth={2.75} />
                </Pressable>
              )}
            </View>
          )}

          {showPlace && (
            <View style={styles.placeRow}>
              <Icon name="pin" color={colors.success} size={18} />
              <TextInput
                value={place}
                onChangeText={setPlace}
                placeholder="Где пьёшь? Например, Bar Hoppers"
                placeholderTextColor={colors.textMuted}
                style={styles.placeInput}
                maxLength={80}
              />
            </View>
          )}
        </ScrollView>

        <View style={[styles.toolbar, { paddingBottom: kb.keyboardVisible ? 12 : Math.max(insets.bottom, 14) }]}>
          {tools.map((t) => (
            <Pressable key={t.key} onPress={t.onPress} style={[styles.tool, t.active && styles.toolActive]}>
              <Icon name={t.icon} color={t.active ? colors.background : "#474238"} size={18} />
              <Text style={[styles.toolText, t.active && { color: colors.background }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <BeerPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(b) => {
          setBeer(b);
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 6 },
  cancel: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: "#474238" },
  topTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  publish: { height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", minWidth: 118 },
  publishText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.background },

  content: { padding: spacing.lg, gap: 16, paddingBottom: spacing.xl },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  authorName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  visibility: { marginTop: 3, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.border, alignSelf: "flex-start" },
  visibilityText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#474238" },
  input: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26, color: colors.text, minHeight: 110, textAlignVertical: "top" },

  beerCard: { backgroundColor: colors.card, borderRadius: 24, padding: 12, gap: 12 },
  beerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  beerName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  beerSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEE7DB", alignItems: "center", justifyContent: "center" },
  ratingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingLeft: 14, paddingRight: 12 },
  ratingLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#474238" },
  ratingHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },

  photoRow: { flexDirection: "row", gap: 10 },
  photoTile: { width: 96, height: 96, borderRadius: 22, overflow: "hidden", backgroundColor: colors.border },
  photoImage: { width: "100%", height: "100%" },
  photoBusy: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,.35)", alignItems: "center", justifyContent: "center" },
  photoRemove: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" },
  photoAdd: { borderWidth: 2, borderStyle: "dashed", borderColor: "#A19786", backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },

  placeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  placeInput: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.success, paddingVertical: 6 },

  toolbar: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, paddingTop: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  tool: { height: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.border, flexDirection: "row", alignItems: "center", gap: 6 },
  toolActive: { backgroundColor: colors.success },
  toolText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#474238" },
});
