import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { BeerArt } from "../../components/BeerArt";
import { MatchBadge } from "../../components/MatchBadge";
import { tasteProfileApi } from "../../api/beervia";
import { colors, fonts, radius, spacing, typography } from "../../theme/colors";
import { QuizResult } from "../../types";

type Props = { onDone: (openCamera: boolean) => void };

type Axis = "bitterness" | "body" | "aroma" | "sweetness" | "sourness";
type Occasion = "classic" | "adventurous";
type Field = Axis | "targetAbv" | "occasion";
type Step = "welcome" | "quiz" | "result" | "bridge";
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
// выбранным ответом — а не раскрывается заранее в самом вопросе. Сценарии
// разные (еда, дом, привычки, спорт, путешествия), чтобы не превращаться в
// однообразный «выбери еду А или Б».
const QUESTIONS: Question[] = [
  {
    field: "bitterness",
    label: "В салате для тебя обязательны...",
    options: [
      {
        value: 25,
        title: "Мягкий микс без горечи",
        icon: "🥬",
        tint: "accent",
        rationale: "Тебе комфортнее без горчинки во вкусе — скорее всего, ближе мягкая горечь, а не резкая хмелевая.",
      },
      {
        value: 75,
        title: "Руккола или радиккио",
        icon: "🌿",
        tint: "primary",
        rationale: "Любишь горчинку в блюде — за неё отвечают те же рецепторы, что и за хмелевую горечь в пиве.",
      },
    ],
  },
  {
    field: "body",
    label: "Каким пледом укрываешься зимой?",
    options: [
      {
        value: 25,
        title: "Тонким и лёгким",
        icon: "🧣",
        tint: "accent",
        rationale: "Любишь лёгкость — тебе, вероятно, ближе лёгкое, воздушное пиво вроде лагера.",
      },
      {
        value: 75,
        title: "Плотным, чтобы утонуть",
        icon: "🛋️",
        tint: "primary",
        rationale: "Тянет укутаться поплотнее — так же тебе, скорее всего, понравится плотное тело стаута или портера.",
      },
    ],
  },
  {
    field: "aroma",
    label: "Свечи дома — какие выбираешь?",
    options: [
      {
        value: 25,
        title: "Едва уловимый запах",
        icon: "🕯️",
        tint: "accent",
        rationale: "Предпочитаешь ненавязчивые запахи — тебе, скорее всего, ближе сдержанный аромат хмеля.",
      },
      {
        value: 75,
        title: "Насыщенный, сразу заметный",
        icon: "🌸",
        tint: "primary",
        rationale: "Любишь яркие узнаваемые запахи — цветочные и цитрусовые ноты хмеля в ярких IPA придутся по вкусу.",
      },
    ],
  },
  {
    field: "sweetness",
    label: "Как заканчиваешь сообщение другу?",
    options: [
      {
        value: 25,
        title: "Просто по делу",
        icon: "📱",
        tint: "accent",
        rationale: "Тебе ближе сдержанность — скорее всего, понравится сухой, некрикливо-сладкий финиш пива.",
      },
      {
        value: 75,
        title: "С сердечком и эмодзи",
        icon: "🥰",
        tint: "primary",
        rationale: "Любишь тепло в мелочах — это часто совпадает с любовью к солодовой сладости в эле или портере.",
      },
    ],
  },
  {
    field: "sourness",
    label: "На фуршете ты первым делом идёшь к...",
    options: [
      {
        value: 25,
        title: "Свежим ягодам и фруктам",
        icon: "🍓",
        tint: "accent",
        rationale: "Кислинка не твоё — лучше начинать с гладких, некислых сортов пива.",
      },
      {
        value: 75,
        title: "Оливкам и соленьям",
        icon: "🫒",
        tint: "primary",
        rationale: "Любовь к маринованному и ферментированному — почти прямой сигнал, что зайдут кислые сауэры.",
      },
    ],
  },
  {
    field: "targetAbv",
    label: "На тренировке тебе ближе...",
    options: [
      {
        value: 4,
        title: "Лёгкая быстрая пробежка",
        icon: "🏃",
        tint: "accent",
        rationale: "Любишь лёгкость и темп — для такого настроения обычно выбирают пиво, которое пьётся не спеша весь вечер.",
      },
      {
        value: 8.5,
        title: "Медленная силовая, на измор",
        icon: "🏋️",
        tint: "primary",
        rationale: "Готов(а) выкладываться основательно — так же стоит подойти и к крепкому пиву, его смакуют маленькими глотками.",
      },
    ],
  },
  {
    field: "occasion",
    label: "В новом городе ты идёшь...",
    options: [
      {
        value: "classic",
        title: "В место, которое уже знаешь",
        icon: "🗺️",
        tint: "accent",
        rationale: "Тебе комфортно с проверенным — предложим классические, надёжные стили.",
      },
      {
        value: "adventurous",
        title: "Туда, где не был, наугад",
        icon: "🧭",
        tint: "primary",
        rationale: "Любишь неизвестность — покажем более смелые и необычные сорта.",
      },
    ],
  },
];

const AXIS_LABEL: Record<Axis, string> = {
  bitterness: "Горечь",
  body: "Плотность",
  aroma: "Аромат хмеля",
  sweetness: "Сладость",
  sourness: "Кислотность",
};

function isAxis(field: Field): field is Axis {
  return field in AXIS_LABEL;
}

const TAG_WORDS: Record<Axis, { low: string; high: string }> = {
  sweetness: { low: "Сухое", high: "Сладкое" },
  bitterness: { low: "Мягкая горечь", high: "Яркая горечь" },
  sourness: { low: "Без кислинки", high: "С кислинкой" },
  aroma: { low: "Сдержанный аромат", high: "Яркий хмель" },
  body: { low: "Лёгкое тело", high: "Плотное тело" },
};

function personaTags(profile: Record<Axis, number>): string[] {
  return (Object.keys(TAG_WORDS) as Axis[])
    .map((axis) => ({ axis, dist: Math.abs(profile[axis] - 50) }))
    .sort((a, b) => b.dist - a.dist)
    .slice(0, 3)
    .map(({ axis }) => (profile[axis] >= 50 ? TAG_WORDS[axis].high : TAG_WORDS[axis].low));
}

const SCALE_ROWS: { axis: Axis; label: string; low: string; high: string }[] = [
  { axis: "sweetness", label: "Сладость", low: "Сухое", high: "Сладкое" },
  { axis: "bitterness", label: "Горечь", low: "Мягкая", high: "Выраженная" },
  { axis: "sourness", label: "Кислотность", low: "Гладкая", high: "С кислинкой" },
  { axis: "aroma", label: "Аромат хмеля", low: "Сдержанный", high: "Яркий" },
  { axis: "body", label: "Плотность", low: "Лёгкое", high: "Плотное" },
];

export function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>("welcome");
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

  function goBack() {
    if (questionIndex === 0) return;
    const prevIndex = questionIndex - 1;
    transitionTo(() => {
      setQuestionIndex(prevIndex);
      // Возвращает уже выбранный ответ на предыдущий вопрос, если он был —
      // так «Назад» показывает то же состояние, а не пустой вопрос заново.
      setSelectedValue(answers[QUESTIONS[prevIndex].field] ?? null);
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
      {step === "welcome" && (
        <View style={styles.content}>
          <Animated.View style={[styles.welcomeBody, animatedStyle]}>
            <View style={styles.welcomeArt}>
              <View style={styles.welcomeCircleBig} />
              <View style={styles.welcomeCircleSmall} />
              <View style={[styles.welcomeGlass, styles.welcomeGlassStout]} />
              <View style={[styles.welcomeGlass, styles.welcomeGlassAmber]}>
                <View style={styles.welcomeGlassFoam} />
              </View>
              <View style={[styles.welcomeGlass, styles.welcomeGlassRed]} />
              <View style={[styles.welcomeBadge, styles.welcomeBadgeMatch]}>
                <Text style={styles.welcomeBadgeMatchText}>92% твоё</Text>
              </View>
              <View style={[styles.welcomeBadge, styles.welcomeBadgeStyle]}>
                <Text style={styles.welcomeBadgeStyleText}>Stout · 61%</Text>
              </View>
            </View>

            <Text style={styles.welcomeTitle}>Найдём пиво, которое зайдёт именно тебе</Text>
            <Text style={styles.welcomeSubtitle}>
              7 коротких вопросов — и сканер начнёт показывать процент совпадения для любой банки.
            </Text>

            <View style={styles.welcomeActions}>
              <Button title="Начать" onPress={() => transitionTo(() => setStep("quiz"))} />
              <Pressable onPress={() => onDone(false)} hitSlop={8}>
                <Text style={styles.welcomeSkip}>Пропустить</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}

      {step === "quiz" && (
        <ScrollView contentContainerStyle={styles.quizScroll}>
          <View style={styles.topRow}>
            {questionIndex > 0 ? (
              <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8}>
                <Text style={styles.backBtnIcon}>←</Text>
              </Pressable>
            ) : (
              <View style={styles.backBtn} />
            )}
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
                {isAxis(question.field) && typeof selectedValue === "number" && (
                  <View style={styles.deltaRow}>
                    <Text style={styles.deltaLabel}>{AXIS_LABEL[question.field]}</Text>
                    <View style={styles.deltaTrack}>
                      <View style={[styles.deltaFill, { width: `${selectedValue}%` }]} />
                    </View>
                    <View style={styles.deltaBadge}>
                      <Text style={styles.deltaBadgeText}>{selectedValue > 50 ? "+" : "−"}{Math.abs(selectedValue - 50)}</Text>
                    </View>
                  </View>
                )}
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
                <Text style={styles.resultEyebrow}>Твой вкусовой профиль</Text>
                <Text style={styles.resultTitle}>{result.persona.title}</Text>
                <View style={styles.tagRow}>
                  {personaTags(result.profile).map((tag) => (
                    <View key={tag} style={styles.tagPill}>
                      <Text style={styles.tagPillText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.scaleList}>
                  {SCALE_ROWS.map((row, i) => (
                    <View key={row.axis} style={styles.scaleRow}>
                      <Text style={styles.scaleLabel}>{row.label}</Text>
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
                  title="Продолжить"
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
            <View style={styles.bridgeArt}>
              <View style={styles.bridgeCircle} />
              <Animated.View style={[styles.bridgeFrame, { transform: [{ scale: pulse }] }]}>
                <View style={[styles.bridgeCorner, styles.cornerTL]} />
                <View style={[styles.bridgeCorner, styles.cornerTR]} />
                <View style={[styles.bridgeCorner, styles.cornerBL]} />
                <View style={[styles.bridgeCorner, styles.cornerBR]} />
                <View style={styles.bridgeCan}>
                  <View style={styles.bridgeCanFoam} />
                </View>
              </Animated.View>
              <View style={styles.bridgeBadge}>
                <Text style={styles.bridgeBadgeText}>92%</Text>
              </View>
            </View>

            <Text style={styles.bridgeTitle}>Теперь наведи камеру на любое пиво</Text>
            <Text style={styles.bridgeSubtitle}>
              Этикетка, банка или меню в баре — покажем, насколько зайдёт именно тебе.
            </Text>

            <View style={styles.bridgeActions}>
              <Button title="📷  Открыть камеру" onPress={() => onDone(true)} />
              <Pressable onPress={() => onDone(false)} hitSlop={8}>
                <Text style={styles.welcomeSkip}>Сначала посмотрю каталог</Text>
              </Pressable>
            </View>
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

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnIcon: { fontSize: 18, color: colors.text },
  progressWrap: { flex: 1, gap: spacing.xs },
  progressLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.textMuted },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  skip: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted, textDecorationLine: "underline" },

  welcomeBody: { flex: 1, justifyContent: "center", gap: spacing.md },
  welcomeArt: { height: 220, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  welcomeCircleBig: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.border,
  },
  welcomeCircleSmall: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E1EECC",
    left: 16,
    top: 110,
  },
  welcomeGlass: { position: "absolute", borderRadius: 14 },
  welcomeGlassStout: { width: 42, height: 78, backgroundColor: colors.text, left: 78, top: 60, transform: [{ rotate: "-6deg" }] },
  welcomeGlassAmber: { width: 56, height: 104, backgroundColor: colors.accent, left: 128, top: 30 },
  welcomeGlassFoam: { position: "absolute", left: 5, right: 5, top: 5, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.5)" },
  welcomeGlassRed: { width: 40, height: 70, backgroundColor: colors.primary, left: 196, top: 74, transform: [{ rotate: "5deg" }] },
  welcomeBadge: {
    position: "absolute",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeBadgeMatch: { backgroundColor: colors.success, right: 8, top: 18 },
  welcomeBadgeMatchText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#F0FAE1" },
  welcomeBadgeStyle: { backgroundColor: colors.card, left: 0, top: 140 },
  welcomeBadgeStyleText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#8C491A" },
  welcomeTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.text, textAlign: "center" },
  welcomeSubtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textMuted, textAlign: "center" },
  welcomeActions: { marginTop: spacing.md, gap: spacing.sm, alignItems: "stretch" },
  welcomeSkip: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xs },

  quizBody: { flex: 1, justifyContent: "center", gap: spacing.lg },
  questionLabel: { fontFamily: fonts.display, fontSize: 24, color: colors.primary, textAlign: "center" },
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
  optionTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.text },

  rationaleCard: {
    backgroundColor: "#E1EECC",
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  rationaleLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.success,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rationaleText: { fontFamily: fonts.body, fontSize: 14, color: "#272E1B", lineHeight: 20 },
  rationaleButton: { marginTop: spacing.xs },

  deltaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  deltaLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: "#272E1B", width: 100 },
  deltaTrack: { flex: 1, height: 8, borderRadius: 9, backgroundColor: "#CCDBB2" },
  deltaFill: { height: "100%", borderRadius: 9, backgroundColor: colors.success },
  deltaBadge: { backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  deltaBadgeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#F0FAE1" },

  resultScroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  resultLoading: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl * 2, gap: spacing.md },
  resultLoadingText: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, textAlign: "center" },
  resultEyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#8C491A" },
  resultTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.text, marginTop: spacing.sm },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  tagPill: { backgroundColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  tagPillText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },

  scaleList: { gap: spacing.md, marginTop: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4 },
  scaleRow: { gap: 7 },
  scaleLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  scaleTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: 2 },
  scaleDot: {
    position: "absolute",
    top: -5,
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
  scaleEndText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },

  recWrap: { marginTop: spacing.lg, gap: spacing.sm },
  recLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 6,
    backgroundColor: colors.card,
    borderRadius: radius.lg - 4,
    padding: spacing.sm + 4,
  },
  recInfo: { flex: 1, gap: 4 },
  recName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  recMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  resultButton: { marginTop: spacing.xl },

  bridgeBody: { flex: 1, justifyContent: "center", gap: spacing.md },
  bridgeArt: { height: 260, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  bridgeCircle: { position: "absolute", width: 230, height: 230, borderRadius: 115, backgroundColor: "#FBDFD3" },
  bridgeFrame: { width: 150, height: 180 },
  bridgeCorner: { position: "absolute", width: 30, height: 30, borderColor: colors.primary },
  cornerTL: { left: 0, top: 0, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 18 },
  cornerTR: { right: 0, top: 0, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 18 },
  cornerBL: { left: 0, bottom: 0, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 18 },
  cornerBR: { right: 0, bottom: 0, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 18 },
  bridgeCan: { position: "absolute", left: 46, top: 28, width: 58, height: 124, borderRadius: 16, backgroundColor: colors.accent },
  bridgeCanFoam: { position: "absolute", left: 5, right: 5, top: 5, height: 7, borderRadius: 3, backgroundColor: "rgba(255,255,255,.45)" },
  bridgeBadge: {
    position: "absolute",
    right: 30,
    top: 60,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  bridgeBadgeText: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#F0FAE1" },
  bridgeTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.text },
  bridgeSubtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  bridgeActions: { marginTop: spacing.md, gap: spacing.sm, alignItems: "stretch" },
});
