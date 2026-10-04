import React, { useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { BackButton } from "../../components/BackButton";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { beersApi } from "../../api/beervia";
import { apiErrorMessage } from "../../api/client";
import { useKeyboardAvoidance } from "../../lib/useKeyboardAvoidance";
import { colors, fonts, radius, spacing } from "../../theme/colors";
import { HomeStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<HomeStackParamList, "AddBeer">;

// Те же названия стилей, что в каталоге: по ним считается приблизительный вкус нового пива.
const STYLES = [
  "Lager", "Pilsner", "IPA", "New England IPA", "Pale Ale", "Weizen",
  "Stout", "Porter", "Sour", "Belgian Strong Ale", "Amber Ale", "Dark Lager", "Другое",
];

export function AddBeerScreen({ navigation, route }: Props) {
  const kb = useKeyboardAvoidance();
  const barcode = route.params?.barcode;
  const [name, setName] = useState(route.params?.name ?? "");
  const [brewery, setBrewery] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [abv, setAbv] = useState("");
  const [saving, setSaving] = useState(false);

  const abvNumber = Number(abv.replace(",", "."));
  const abvValid = abv.trim() !== "" && Number.isFinite(abvNumber) && abvNumber >= 0 && abvNumber <= 25;
  const canSave = name.trim().length >= 2 && brewery.trim().length >= 2 && style !== null && abvValid;

  async function save() {
    if (!canSave || saving || !style) return;
    setSaving(true);
    try {
      const { id } = await beersApi.add({
        name: name.trim(),
        breweryName: brewery.trim(),
        style,
        abv: abvNumber,
        barcode,
      });
      navigation.replace("BeerDetail", { beerId: id });
    } catch (e) {
      Alert.alert("Не получилось добавить", apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Добавить пиво</Text>
      </View>

      <Animated.View ref={kb.ref} collapsable={false} style={[{ flex: 1 }, kb.style]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.note}>
            Этого пива пока нет в базе. Добавьте его: следующий, кто его найдёт, увидит карточку сразу.
            {barcode ? ` Штрихкод ${barcode} запомнится, и в следующий раз скан узнает эту банку.` : ""}
          </Text>

          <TextField label="Название" value={name} onChangeText={setName} placeholder="Например, Жигулёвское" maxLength={80} />
          <TextField label="Пивоварня" value={brewery} onChangeText={setBrewery} placeholder="Например, Очаково" maxLength={60} />

          <Text style={styles.label}>Стиль</Text>
          <View style={styles.chips}>
            {STYLES.map((s) => (
              <Pressable key={s} onPress={() => setStyle(s)} style={[styles.chip, style === s && styles.chipActive]}>
                <Text style={[styles.chipText, style === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>Не уверены — выберите «Другое». Вкус мы оценим по типичному для стиля.</Text>

          <TextField
            label="Крепость, %"
            value={abv}
            onChangeText={setAbv}
            placeholder="Например, 4.7"
            keyboardType="decimal-pad"
            maxLength={5}
          />
          {abv.trim() !== "" && !abvValid && <Text style={styles.error}>Крепость — число от 0 до 25</Text>}

          <Button title="Добавить" onPress={save} loading={saving} disabled={!canSave} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingTop: 6 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted, marginBottom: spacing.md },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text, marginBottom: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.background },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 8, marginBottom: spacing.md },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, marginTop: -8, marginBottom: spacing.sm },
});
