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

export type WhyRow = { text: string; good: boolean };

const GAP_TEXT: Record<keyof TasteProfile, { more: string; less: string }> = {
  bitterness: { more: "Горчит сильнее, чем тебе обычно нравится", less: "Горчит слабее, чем тебе обычно нравится" },
  body: { more: "Плотнее, чем ты любишь", less: "Легче, чем ты любишь" },
  aroma: { more: "Аромат ярче, чем тебе обычно нравится", less: "Аромат скромнее, чем ты любишь" },
  sweetness: { more: "Слаще, чем ты любишь", less: "Суше, чем ты любишь" },
  sourness: { more: "Кислее, чем ты любишь", less: "Кислинки меньше, чем ты любишь" },
};

/**
 * Что совпало и что нет, по осям вкуса: до двух «зелёных» строк (ось, где вкус пива и пользователя близки и
 * у пользователя есть явное предпочтение) и одна «оранжевая» (самое большое расхождение).
 */
export function whyMatchRows(beer: TasteProfile, user: TasteProfile): WhyRow[] {
  const rows = AXES.map((axis) => ({ axis, diff: Math.abs(beer[axis] - user[axis]), beerHigh: beer[axis] >= 50, strong: user[axis] >= 60 || user[axis] <= 40 }));
  const good = rows
    .filter((r) => r.diff <= 15 && r.strong)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 2)
    .map((r): WhyRow => {
      const trait = TRAITS[r.axis][r.beerHigh ? "high" : "low"];
      return { text: `${trait.charAt(0).toUpperCase()}${trait.slice(1)} — как ты любишь`, good: true };
    });
  const worst = [...rows].sort((a, b) => b.diff - a.diff)[0];
  const result = [...good];
  if (worst.diff > 20) result.push({ text: GAP_TEXT[worst.axis][beer[worst.axis] > user[worst.axis] ? "more" : "less"], good: false });
  return result;
}
