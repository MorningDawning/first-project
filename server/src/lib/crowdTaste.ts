import { prisma } from "./prisma";
import type { TasteVector } from "./taste";

type Axis = keyof TasteVector;

/** Что говорит тег про вкус: по какой оси и в какую сторону (высоко или низко). */
export const TASTE_TAGS: Record<string, { axis: Axis; high: boolean }> = {
  "Сладкое": { axis: "sweetness", high: true },
  "Слишком сладкое": { axis: "sweetness", high: true },
  "Сухое": { axis: "sweetness", high: false },
  "Горькое": { axis: "bitterness", high: true },
  "Мягкая горечь": { axis: "bitterness", high: false },
  "Кислое": { axis: "sourness", high: true },
  "Без кислинки": { axis: "sourness", high: false },
  "Плотное": { axis: "body", high: true },
  "Водянистое": { axis: "body", high: false },
  "Ароматное": { axis: "aroma", high: true },
  "Цитрус": { axis: "aroma", high: true },
  "Тропики": { axis: "aroma", high: true },
  "Сочный": { axis: "aroma", high: true },
  "Слабый аромат": { axis: "aroma", high: false },
};

const AXES: Axis[] = ["sweetness", "bitterness", "sourness", "body", "aroma"];
const HIGH = 85; // что «означает» голос за «много» на шкале 0–100
const LOW = 15;
const PRIOR_WEIGHT = 4; // оценка по стилю весит как столько голосов: пара голосов её не переворачивает
export const USERS_MIN_VOTES = 5; // с этого числа оценивших вкус сорта подписан как «по оценкам»

/**
 * Вкус сорта: оценка по стилю как начальное значение, к которому добавляются голоса пользователей.
 * Чем больше голосов по оси, тем меньше остаётся от оценки по стилю; противоположные голоса гасят друг друга.
 */
export function blendTaste(base: TasteVector, tagLists: string[][]): { taste: TasteVector; voters: number } {
  const sums: Record<Axis, number> = { sweetness: 0, bitterness: 0, sourness: 0, body: 0, aroma: 0 };
  const counts: Record<Axis, number> = { sweetness: 0, bitterness: 0, sourness: 0, body: 0, aroma: 0 };
  let voters = 0;
  for (const tags of tagLists) {
    // Один человек — один голос по оси, даже если выбрал «Цитрус» и «Тропики» вместе.
    const byAxis = new Map<Axis, number[]>();
    for (const tag of tags) {
      const rule = TASTE_TAGS[tag];
      if (rule) byAxis.set(rule.axis, [...(byAxis.get(rule.axis) ?? []), rule.high ? HIGH : LOW]);
    }
    if (byAxis.size > 0) voters++;
    for (const [axis, values] of byAxis) {
      sums[axis] += values.reduce((a, b) => a + b, 0) / values.length;
      counts[axis]++;
    }
  }
  const taste = {} as TasteVector;
  for (const axis of AXES) {
    taste[axis] = Math.round((base[axis] * PRIOR_WEIGHT + sums[axis]) / (PRIOR_WEIGHT + counts[axis]));
  }
  return { taste, voters };
}

/** Пересчитывает вкус сорта по всем отзывам с тегами. Оценка по стилю запоминается один раз и дальше не меняется. */
export async function recalcBeerTaste(beerId: string): Promise<void> {
  const beer = await prisma.beer.findUnique({ where: { id: beerId }, include: { reviews: { select: { tags: true } } } });
  if (!beer) return;
  const base: TasteVector = beer.tasteBase
    ? JSON.parse(beer.tasteBase)
    : { sweetness: beer.sweetness, bitterness: beer.bitterness, sourness: beer.sourness, body: beer.body, aroma: beer.aroma };
  const { taste, voters } = blendTaste(base, beer.reviews.map((r) => JSON.parse(r.tags) as string[]));
  await prisma.beer.update({
    where: { id: beerId },
    data: { ...taste, tasteBase: JSON.stringify(base), tasteVotes: voters },
  });
}
