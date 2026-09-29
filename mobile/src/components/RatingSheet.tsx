import React, { useEffect, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BeerArt } from "./BeerArt";
import { StarRating } from "./StarRating";
import { Button } from "./Button";
import { useKeyboardAvoidance } from "../lib/useKeyboardAvoidance";
import { colors, fonts, radius, spacing } from "../theme/colors";

export const FLAVOR_TAGS = ["Сочный", "Цитрус", "Мягкая горечь", "Плотное", "Тропики", "Водянистое", "Слишком сладкое"];

type Props = {
  visible: boolean;
  beerName: string;
  imageUrl?: string | null;
  initialRating: number;
  initialText: string;
  initialTags: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (rating: number, text: string, tags: string[]) => void;
};

export function RatingSheet({
  visible,
  beerName,
  imageUrl,
  initialRating,
  initialText,
  initialTags,
  saving,
  onClose,
  onSave,
}: Props) {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText);
  const [tags, setTags] = useState<string[]>(initialTags);
  const kb = useKeyboardAvoidance();

  useEffect(() => {
    if (visible) {
      setRating(initialRating);
      setText(initialText);
      setTags(initialTags);
    }
  }, [visible, initialRating, initialText, initialTags]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View ref={kb.ref} collapsable={false} style={[styles.overlay, kb.style]}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, kb.keyboardVisible && { paddingBottom: spacing.lg }]}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <BeerArt name={beerName} imageUrl={imageUrl} size={52} shape="rounded" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Как тебе {beerName}?</Text>
            <Text style={styles.headerSubtitle}>Оценка уточнит твой профиль</Text>
          </View>
        </View>

        <StarRating rating={rating} onChange={setRating} size={40} />

        <View style={styles.tagsBlock}>
          <Text style={styles.tagsLabel}>Что почувствовал</Text>
          <View style={styles.tags}>
            {FLAVOR_TAGS.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tag, selected && styles.tagSelected]}
                >
                  <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Пара слов для друзей…"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />

        <Button
          title="Сохранить"
          onPress={() => onSave(rating, text, tags)}
          loading={saving}
          disabled={rating === 0}
        />
      </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(44,24,16,0.4)" },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  handle: { width: 44, height: 5, borderRadius: 9, backgroundColor: colors.border, alignSelf: "center" },

  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  headerSubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 },

  tagsBlock: { gap: spacing.sm },
  tagsLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tagSelected: { backgroundColor: colors.success, borderColor: colors.success },
  tagText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  tagTextSelected: { color: "#fff" },

  input: {
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: "top",
  },
});
