import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { BeerArt } from "../../components/BeerArt";
import { MatchBadge } from "../../components/MatchBadge";
import { tasteProfileApi } from "../../api/beervia";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { QuizResult } from "../../types";

type Props = { onDone: (openCamera: boolean) => void };

type Axis = "bitterness" | "body" | "aroma" | "sweetness" | "sourness";
type Occasion = "classic" | "adventurous";
type Field = Axis | "targetAbv" | "occasion";
type Step = "quiz" | "result" | "bridge";
type Tint = "accent" | "primary";

type Answers = {
  bitterness?: number;
  body?: number;
  aroma?: number;
  sweetness?: number;
  sourness?: number;
  targetAbv?: number;
  occasion?: Occasion;
};

const TINTS: Record<Tint, { badge: string; selectedBg: string; border: string }> = {
  accent: { badge: "#FBEAD0", selectedBg: "#FCF1DE", border: colors.accent },
  primary: { badge: "#FBDFD3", selectedBg: "#FCE6DB", border: colors.primary },
};

type QuizOption = { value: number | Occasion; title: string; icon: string; tint: Tint; rationale: string };
type Question = { field: Field; label: string; options: [QuizOption, QuizOption] };

// Вопросы намеренно не про пиво напрямую — по образцу винных квизов вроде
// Vivino ("какой кофе вы любите?" → чёрный кофе разлюбит терпкость в вине).
// Химия горьких/кислых/сладких рецепторов действительно частично общая для
// разных продуктов, так что связка с пивом объясняется в rationale под
// выбранным ответом — а не раскрывается заранее в самом вопросе.
const QUESTIONS: Question[] = [
  {
    field: "bitterness",
    label: "Какой кофе ты выбираешь?",
    options: [
      {
        value: 25,
        title: "С молоком и сиропом",
        icon: "🥛",
        tint: "accent",
        rationale: "Если комфортнее смягчать горечь кофе молоком, скорее всего понравится и мягкая горечь в пиве.",
      },
      {
        value: 75,
        title: "Чёрный, без сахара",
        icon: "☕",
        tint: "primary",
        rationale: "Кофеин и хмелевая горечь бьют по одним рецепторам — любители чёрного кофе почти всегда легко заходят на горькие сорта вроде IPA.",
      },
    ],
  },
  {
    field: "body",
    label: "Что тебе ближе на обед?",
    options: [
      {
        value: 25,
        title: "Лёгкий бульон",
        icon: "💧",
        tint: "accent",
        rationale: "Любовь к лёгкой еде обычно совпадает с любовью к лёгкому, воздушному пиву вроде лагера.",
      },
      {
        value: 75,
        title: "Наваристый крем-суп",
        icon: "🍲",
        tint: "primary",
        rationale: "Чем плотнее и сытнее тебе нравится еда, тем вероятнее зайдёт плотное тело стаута или портера.",
      },
    ],
  },
  {
    field: "aroma",
    label: "Какой аромат тебе приятнее?",
    options: [
      {
        value: 25,
        title: "Едва уловимый",
        icon: "🕯️",
        tint: "accent",
        rationale: "Тебе, скорее всего, ближе сдержанный, ненавязчивый аромат — как у лагеров с лёгким хмелем.",
      },
      {
        value: 75,
        title: "Яркая цедра цитруса",
        icon: "🍋",
        tint: "primary",
        rationale: "Эфирные масла в цедре цитрусовых химически похожи на ароматику хмеля — любишь первое, полюбишь и яркие IPA.",
      },
    ],
  },
  {
    field: "sweetness",
    label: "На десерт ты выбираешь...",
    options: [
      {
        value: 25,
        title: "Тёмный шоколад",
        icon: "🍫",
        tint: "accent",
        rationale: "Если комфортно без сахара, вероятно понравится сухой, некрикливо-сладкий финиш пива.",
      },
      {
        value: 75,
        title: "Карамель и мёд",
        icon: "🍯",
        tint: "primary",
        rationale: "Тяга к карамели и мёду часто выдаёт любовь к солодовой сладости — она есть в элях и портерах.",
      },
    ],
  },
  {
    field: "sourness",
    label: "Из закусок тебе ближе...",
    options: [
      {
        value: 25,
        title: "Свежие сладкие фрукты",
        icon: "🍑",
        tint: "accent",
        rationale: "Если кислинка не твоё, лучше заходить с гладких, некислых сортов пива.",
      },
      {
        value: 75,
        title: "Квашеная капуста, соленья",
        icon: "🥒",
        tint: "primary",
        rationale: "Любовь к ферментированным продуктам — почти прямой сигнал, что зайдут кислые сауэры.",
      },
    ],
  },
  {
    field: "targetAbv",
    label: "Как проходит твой любимый вечер?",
    options: [
      {
        value: 4,
        title: "Активно, в компании",
        icon: "🎉",
        tint: "accent",
        rationale: "Для активных встреч обычно выбирают лёгкое пиво, которое можно пить не спеша весь вечер.",
      },
      {
        value: 8.5,
        title: "Спокойно, наедине с книгой",
        icon: "📖",
        tint: "primary",
        rationale: "Для неспешного вечера отлично подходит крепкое пиво — его смакуют маленькими глотками.",
      },
    ],
  },
  {
    field: "occasion",
    label: "В любимом кафе ты берёшь...",
    options: [
      {
        value: "classic",
        title: "Свой обычный заказ",
        icon: "⭐",
        tint: "accent",
        rationale: "Тебе комфортно с проверенным — предложим классические, надёжные стили.",
      },
      {
        value: "adventurous",
        title: "Новинку из спецменю",
        icon: "🎲",
        tint: "primary",
        rationale: "Любишь пробовать новое — покажем более смелые и необычные сорта.",
      },
    ],
  },
];

const SCALE_ROWS: { axis: Axis; icon: string; label: string; low: string; high: string }[] = [
  { axis: "sweetness", icon: "🍬", label: "Сладость", low: "Сухое", high: "Сладкое" },
  { axis: "bitterness", icon: "🌿", label: "Горечь", low: "Мягкая", high: "Выраженная" },
  { axis: "sourness", icon: "🍏", label: "Кислотность", low: "Гладкая", high: "С кислинкой" },
  { axis: "aroma", icon: "✨", label: "Аромат хмеля", low: "Сдержанный", high: "Яркий" },
  { axis: "body", icon: "🍺", label: "Плотность", low: "Лёгкое", high: "Плотное" },
];

export function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>("quiz");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [selectedValue, setSelectedValue] = useState<number | Occasion | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [resultError, setResultError] = useState(false);

  const anim = useRef(new Animated.Value(0)).current;
  const rationaleAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef(SCALE_ROWS.map(() => new Animated.Value(0))).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [step, questionIndex, anim]);

  useEffect(() => {
    if (step !== "result" || !result) return;
    const animations = SCALE_ROWS.map((row, i) =>
      Animated.timing(dotAnims[i], {
        toValue: result.profile[row.axis],
        duration: 650,
        delay: 150 + i * 110,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, [step, result, dotAnims]);

  useEffect(() => {
    if (selectedValue === null) return;
    rationaleAnim.setValue(0);
    Animated.timing(rationaleAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedValue, rationaleAnim]);

  useEffect(() => {
    if (step !== "bridge") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step, pulse]);

  function transitionTo(next: () => void) {
    Animated.timing(anim, { toValue: 0, duration: 150, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(next);
  }

  async function submitQuiz(complete: Required<Answers>) {
    setLoadingResult(true);
    setResultError(false);
    try {
      const res = await tasteProfileApi.submitQuiz(complete);
      setResult(res);
    } catch {
      setResultError(true);
    } finally {
      setLoadingResult(false);
    }
  }

  function selectOption(field: Field, value: number | Occasion) {
    if (selectedValue !== null) return;
    setSelectedValue(value);
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function goNext() {
    const isLast = questionIndex === QUESTIONS.length - 1;
    const finalAnswers = answers;
    transitionTo(() => {
      if (isLast) {
        setStep("result");
        submitQuiz(finalAnswers as Required<Answers>);
      } else {
        setQuestionIndex((i) => i + 1);
        setSelectedValue(null);
      }
    });
  }

  const animatedStyle = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
    ],
  };

  const question = QUESTIONS[questionIndex];

  return (
    <Screen>
      {step === "quiz" && (
        <ScrollView contentContainerStyle={styles.quizScroll}>
          <View style={styles.topRow}>
            <View style={styles.progressWrap}>
              <Text style={styles.progressLabel}>
                Вопрос {questionIndex + 1} из {QUESTIONS.length}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${((questionIndex + 1) / QUESTIONS.length) * 100}%` }]}
                />
              </View>
            </View>
            <Pressable onPress={() => onDone(false)} hitSlop={8}>
              <Text style={styles.skip}>Пропустить</Text>
            </Pressable>
          </View>

          <Animated.View style={[styles.quizBody, animatedStyle]}>
            <Text style={styles.questionLabel}>{question.label}</Text>
            <View style={styles.optionsCol}>
              {question.options.map((opt) => {
                const tint = TINTS[opt.tint];
                const selected = selectedValue === opt.value;
                return (
                  <Pressable
                    key={opt.title}
                    onPress={() => selectOption(question.field, opt.value)}
                    disabled={selectedValue !== null}
                    style={({ pressed }) => [
                      styles.optionCard,
                      pressed && !selected && styles.optionCardPressed,
                      selected && { borderColor: tint.border, backgroundColor: tint.selectedBg },
                    ]}
                  >
                    <View style={[styles.optionIconBadge, { backgroundColor: tint.badge }]}>
                      <Text style={styles.optionIcon}>{opt.icon}</Text>
                    </View>
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedValue !== null && (
              <Animated.View
                style={[
                  styles.rationaleCard,
                  {
                    opacity: rationaleAnim,
                    transform: [{ translateY: rationaleAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  },
                ]}
              >
                <Text style={styles.rationaleLabel}>Почему мы спрашиваем</Text>
                <Text style={styles.rationaleText}>
                  {question.options.find((o) => o.value === selectedValue)?.rationale}
                </Text>
                <Button title="Далее →" onPress={goNext} style={styles.rationaleButton} />
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      )}

      {step === "result" && (
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <Animated.View style={animatedStyle}>
            {loadingResult && !result && (
              <View style={styles.resultLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.resultLoadingText}>Собираем твой вкусовой профиль…</Text>
              </View>
            )}

            {resultError && !result && (
              <View style={styles.resultLoading}>
                <Text style={styles.resultLoadingText}>Не удалось загрузить результат</Text>
                <Button
                  title="Повторить"
                  onPress={() => submitQuiz(answers as Required<Answers>)}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )}

            {result && (
              <>
                <Text style={styles.resultCategory}>{result.persona.category}</Text>
                <Text style={styles.resultTitle}>🎉 {result.persona.title}</Text>
                <Text style={styles.resultTagline}>{result.persona.tagline}</Text>

                <View style={styles.scaleList}>
                  {SCALE_ROWS.map((row, i) => (
                    <View key={row.axis} style={styles.scaleRow}>
                      <View style={styles.scaleHeader}>
                        <Text style={styles.scaleIcon}>{row.icon}</Text>
                        <Text style={styles.scaleLabel}>{row.label}</Text>
                      </View>
                      <View style={styles.scaleTrack}>
                        <Animated.View
                          style={[
                            styles.scaleDot,
                            { left: dotAnims[i].interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) },
                          ]}
                        />
                      </View>
                      <View style={styles.scaleEnds}>
                        <Text style={styles.scaleEndText}>{row.low}</Text>
                        <Text style={styles.scaleEndText}>{row.high}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {result.recommendedBeer && (
                  <View style={styles.recWrap}>
                    <Text style={styles.recLabel}>Идеально подходит тебе</Text>
                    <View style={styles.recCard}>
                      <BeerArt name={result.recommendedBeer.name} imageUrl={result.recommendedBeer.imageUrl} size={56} />
                      <View style={styles.recInfo}>
                        <Text style={styles.recName} numberOfLines={1}>
                          {result.recommendedBeer.name}
                        </Text>
                        <Text style={styles.recMeta} numberOfLines={1}>
                          {result.recommendedBeer.brewery.name} · {result.recommendedBeer.style}
                        </Text>
                        {result.recommendedBeer.matchPercent != null && (
                          <MatchBadge percent={result.recommendedBeer.matchPercent} size="sm" />
                        )}
                      </View>
                    </View>
                  </View>
                )}

                <Button
                  title="Далее →"
                  onPress={() => transitionTo(() => setStep("bridge"))}
                  style={styles.resultButton}
                />
              </>
            )}
          </Animated.View>
        </ScrollView>
      )}

      {step === "bridge" && (
        <View style={styles.content}>
          <Animated.View style={[styles.bridgeBody, animatedStyle]}>
            <Animated.View style={[styles.bridgeIconBadge, { transform: [{ scale: pulse }] }]}>
              <Text style={styles.bridgeIcon}>🎯</Text>
            </Animated.View>
            <Text style={styles.bridgeText}>
              Теперь наведи камеру на любое пиво — покажем, насколько зайдёт именно тебе
            </Text>
            <Button title="📷  Сканировать" onPress={() => onDone(true)} style={styles.bridgeButton} />
          </Animated.View>
        </View>
      )}
    </Screen>
  );
}

const DOT_SIZE = 18;

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.lg },
  quizScroll: { flexGrow: 1, padding: spacing.lg },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressWrap: { flex: 1, marginRight: spacing.md, gap: spacing.xs },
  progressLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  skip: { ...typography.caption, textDecorationLine: "underline" },

  quizBody: { flex: 1, justifyContent: "center", gap: spacing.lg },
  questionLabel: { fontSize: 22, fontWeight: "800", color: colors.primary, textAlign: "center" },
  optionsCol: { gap: spacing.md },
  optionCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  optionCardPressed: { borderColor: colors.border, backgroundColor: colors.background },
  optionIconBadge: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  optionIcon: { fontSize: 36 },
  optionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

  rationaleCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rationaleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rationaleText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  rationaleButton: { marginTop: spacing.xs },

  resultScroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  resultLoading: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl * 2, gap: spacing.md },
  resultLoadingText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  resultCategory: { ...typography.caption, fontWeight: "700", color: colors.accent, textAlign: "center" },
  resultTitle: { ...typography.title, textAlign: "center", marginTop: spacing.xs },
  resultTagline: { ...typography.caption, textAlign: "center", marginTop: spacing.xs },

  scaleList: { gap: spacing.lg, marginTop: spacing.xl },
  scaleRow: { gap: spacing.xs },
  scaleHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  scaleIcon: { fontSize: 16 },
  scaleLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  scaleTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: spacing.xs },
  scaleDot: {
    position: "absolute",
    top: -6,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginLeft: -DOT_SIZE / 2,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  scaleEnds: { flexDirection: "row", justifyContent: "space-between" },
  scaleEndText: { fontSize: 11, color: colors.textMuted },

  recWrap: { marginTop: spacing.xl, gap: spacing.sm },
  recLabel: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  recInfo: { flex: 1, gap: 4 },
  recName: { fontSize: 15, fontWeight: "700", color: colors.text },
  recMeta: { fontSize: 13, color: colors.textMuted },

  resultButton: { marginTop: spacing.xl },

  bridgeBody: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg },
  bridgeIconBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: TINTS.primary.badge,
    alignItems: "center",
    justifyContent: "center",
  },
  bridgeIcon: { fontSize: 56 },
  bridgeText: { ...typography.heading, textAlign: "center", paddingHorizontal: spacing.md },
  bridgeButton: { alignSelf: "stretch", marginTop: spacing.md },
});
