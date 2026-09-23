import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { tasteProfileApi } from "../../api/beervia";
import { colors, radius, spacing, typography } from "../../theme/colors";
import { TasteProfile } from "../../types";

type Props = { onDone: (openCamera: boolean) => void };

type Axis = "bitterness" | "body" | "aroma";
type Step = "quiz" | "result" | "bridge";

type Question = {
  axis: Axis;
  label: string;
  options: [{ value: number; title: string; icon: string }, { value: number; title: string; icon: string }];
};

const QUESTIONS: Question[] = [
  {
    axis: "bitterness",
    label: "Горечь",
    options: [
      { value: 25, title: "Мягкая", icon: "🌸" },
      { value: 75, title: "Выраженная", icon: "⚡" },
    ],
  },
  {
    axis: "body",
    label: "Плотность",
    options: [
      { value: 25, title: "Лёгкое", icon: "💧" },
      { value: 75, title: "Плотное", icon: "🍯" },
    ],
  },
  {
    axis: "aroma",
    label: "Аромат хмеля",
    options: [
      { value: 25, title: "Сдержанный", icon: "🌿" },
      { value: 75, title: "Яркий", icon: "🌟" },
    ],
  },
];

const SCALE_ROWS: { axis: Axis; icon: string; label: string; low: string; high: string }[] = [
  { axis: "bitterness", icon: "⚡", label: "Горечь", low: "Мягкая", high: "Выраженная" },
  { axis: "aroma", icon: "🌟", label: "Аромат хмеля", low: "Сдержанный", high: "Яркий" },
  { axis: "body", icon: "🍯", label: "Плотность", low: "Лёгкое", high: "Плотное" },
];

export function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>("quiz");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<Axis, number>>>({});
  const [result, setResult] = useState<TasteProfile | null>(null);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [step, questionIndex, anim]);

  function transitionTo(next: () => void) {
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(next);
  }

  function selectOption(axis: Axis, value: number) {
    const nextAnswers = { ...answers, [axis]: value };
    setAnswers(nextAnswers);
    const isLast = questionIndex === QUESTIONS.length - 1;

    if (isLast) {
      const complete = nextAnswers as Record<Axis, number>;
      // Показываем ответы пользователя сразу же — это и есть "ага"-момент,
      // ждать сеть для него не хотим. Сервер вернёт то же самое, но на всякий
      // случай (offline и т.п.) подменяем результат только при успехе.
      setResult({ sweetness: 50, sourness: 50, bitterness: complete.bitterness, body: complete.body, aroma: complete.aroma });
      tasteProfileApi
        .submitQuiz(complete)
        .then((res) => res.profile && setResult(res.profile))
        .catch(() => {});
    }

    transitionTo(() => {
      if (isLast) setStep("result");
      else setQuestionIndex((i) => i + 1);
    });
  }

  const animatedStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  return (
    <Screen>
      <View style={styles.content}>
        {step === "quiz" && (
          <>
            <View style={styles.topRow}>
              <View style={styles.dots}>
                {QUESTIONS.map((_, i) => (
                  <View key={i} style={[styles.dot, i <= questionIndex && styles.dotActive]} />
                ))}
              </View>
              <Pressable onPress={() => onDone(false)} hitSlop={8}>
                <Text style={styles.skip}>Пропустить</Text>
              </Pressable>
            </View>

            <Animated.View style={[styles.quizBody, animatedStyle]}>
              <Text style={styles.questionLabel}>{QUESTIONS[questionIndex].label}</Text>
              <View style={styles.optionsCol}>
                {QUESTIONS[questionIndex].options.map((opt) => (
                  <Pressable
                    key={opt.title}
                    onPress={() => selectOption(QUESTIONS[questionIndex].axis, opt.value)}
                    style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
                  >
                    <Text style={styles.optionIcon}>{opt.icon}</Text>
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          </>
        )}

        {step === "result" && result && (
          <Animated.View style={[styles.resultBody, animatedStyle]}>
            <Text style={styles.resultTitle}>Твой вкусовой профиль готов</Text>
            <Text style={styles.resultSubtitle}>Вот что мы уже поняли о твоём вкусе</Text>

            <View style={styles.scaleList}>
              {SCALE_ROWS.map((row) => (
                <View key={row.axis} style={styles.scaleRow}>
                  <View style={styles.scaleHeader}>
                    <Text style={styles.scaleIcon}>{row.icon}</Text>
                    <Text style={styles.scaleLabel}>{row.label}</Text>
                  </View>
                  <View style={styles.scaleTrack}>
                    <View style={[styles.scaleDot, { left: `${result[row.axis]}%` }]} />
                  </View>
                  <View style={styles.scaleEnds}>
                    <Text style={styles.scaleEndText}>{row.low}</Text>
                    <Text style={styles.scaleEndText}>{row.high}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Button title="Далее" onPress={() => transitionTo(() => setStep("bridge"))} style={styles.resultButton} />
          </Animated.View>
        )}

        {step === "bridge" && (
          <Animated.View style={[styles.bridgeBody, animatedStyle]}>
            <Text style={styles.bridgeIcon}>🎯</Text>
            <Text style={styles.bridgeText}>
              Теперь наведи камеру на любое пиво — покажем, насколько зайдёт именно тебе
            </Text>
            <Button title="📷  Сканировать" onPress={() => onDone(true)} style={styles.bridgeButton} />
          </Animated.View>
        )}
      </View>
    </Screen>
  );
}

const DOT_SIZE = 16;

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.lg },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dots: { flexDirection: "row", gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  skip: { ...typography.caption, textDecorationLine: "underline" },

  quizBody: { flex: 1, justifyContent: "center", gap: spacing.xl },
  questionLabel: { fontSize: 15, fontWeight: "700", color: colors.textMuted, textAlign: "center", letterSpacing: 1, textTransform: "uppercase" },
  optionsCol: { gap: spacing.md },
  optionCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  optionCardPressed: { borderColor: colors.primary, backgroundColor: "#FBEAE3" },
  optionIcon: { fontSize: 40 },
  optionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

  resultBody: { flex: 1, justifyContent: "center", gap: spacing.lg },
  resultTitle: { ...typography.title, textAlign: "center" },
  resultSubtitle: { ...typography.caption, textAlign: "center", marginTop: -spacing.sm },
  scaleList: { gap: spacing.lg, marginVertical: spacing.md },
  scaleRow: { gap: spacing.xs },
  scaleHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  scaleIcon: { fontSize: 16 },
  scaleLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  scaleTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: spacing.xs },
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
  },
  scaleEnds: { flexDirection: "row", justifyContent: "space-between" },
  scaleEndText: { fontSize: 11, color: colors.textMuted },
  resultButton: { marginTop: spacing.md },

  bridgeBody: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg },
  bridgeIcon: { fontSize: 56 },
  bridgeText: { ...typography.heading, textAlign: "center", paddingHorizontal: spacing.md },
  bridgeButton: { alignSelf: "stretch", marginTop: spacing.md },
});
