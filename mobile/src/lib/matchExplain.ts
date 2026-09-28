import { TasteProfile } from "../types";

const AXES: (keyof TasteProfile)[] = ["bitterness", "body", "aroma", "sweetness", "sourness"];

const AXIS_LABEL: Record<keyof TasteProfile, string> = {
  bitterness: "Горечь",
  body: "Плотность",
  aroma: "Аромат хмеля",
  sweetness: "Сладость",
  sourness: "Кислотность",
};

const TRAITS: Record<keyof TasteProfile, { high: string; low: string }> = {
  bitterness: { high: "яркий хмель", low: "мягкая горечь" },
  body: { high: "плотное тело", low: "лёгкое тело" },
  aroma: { high: "яркий аромат хмеля", low: "сдержанный аромат" },
  sweetness: { high: "заметная сладость", low: "сухой финиш" },
  sourness: { high: "лёгкая кислинка", low: "без кислинки" },
};

export function matchHeadline(percent: number): string {
  if (percent >= 80) return "Отлично зайдёт";
  if (percent >= 60) return "Скорее всего понравится";
  if (percent >= 40) return "Можно попробовать";
  return "Вряд ли твоё";
}

/** A short, human sentence explaining why (or why not) a beer fits the user's taste. */
export function explainMatch(beer: TasteProfile, user: TasteProfile): string {
  const diffs = AXES.map((axis) => ({
    axis,
    diff: Math.abs(beer[axis] - user[axis]),
    beerHigh: beer[axis] >= 50,
  }));
  const closest = [...diffs].sort((a, b) => a.diff - b.diff)[0];
  const farthest = [...diffs].sort((a, b) => b.diff - a.diff)[0];

  const closeTrait = TRAITS[closest.axis][closest.beerHigh ? "high" : "low"];
  let sentence = `${closeTrait.charAt(0).toUpperCase()}${closeTrait.slice(1)} — как ты любишь.`;

  if (farthest.diff > 20 && farthest.axis !== closest.axis) {
    const direction = farthest.beerHigh ? "выраженнее" : "мягче";
    sentence += ` ${AXIS_LABEL[farthest.axis]} ${direction}, чем тебе обычно нравится.`;
  }

  return sentence;
}
