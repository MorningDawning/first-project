import { Beer, Review } from "@prisma/client";
import { prisma } from "./prisma";

export type TasteVector = {
  sweetness: number;
  bitterness: number;
  sourness: number;
  body: number;
  aroma: number;
};

const AXES: (keyof TasteVector)[] = ["sweetness", "bitterness", "sourness", "body", "aroma"];

export function tasteVector(beer: Beer): TasteVector {
  return {
    sweetness: beer.sweetness,
    bitterness: beer.bitterness,
    sourness: beer.sourness,
    body: beer.body,
    aroma: beer.aroma,
  };
}

/** 0-100: 100 = identical taste profiles, 0 = maximally different. */
export function matchPercent(a: TasteVector, b: TasteVector): number {
  const avgAbsDiff = AXES.reduce((sum, axis) => sum + Math.abs(a[axis] - b[axis]), 0) / AXES.length;
  return Math.round(100 - avgAbsDiff);
}

/**
 * Reads the onboarding quiz's declared taste preference for a user, if they've
 * gone through it. Axes the quiz didn't ask about default to a neutral 50.
 */
async function declaredPreference(userId: string): Promise<TasteVector | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const { prefSweetness, prefBitterness, prefSourness, prefBody, prefAroma } = user;
  if ([prefSweetness, prefBitterness, prefSourness, prefBody, prefAroma].every((v) => v == null)) return null;
  return {
    sweetness: prefSweetness ?? 50,
    bitterness: prefBitterness ?? 50,
    sourness: prefSourness ?? 50,
    body: prefBody ?? 50,
    aroma: prefAroma ?? 50,
  };
}

/**
 * Aggregates a user's taste profile from their reviews (weighted by rating),
 * falling back to scan history (implicit neutral-positive weight), then to
 * the onboarding quiz's declared preference, when they haven't rated
 * anything yet. Returns null if the user has no signal at all.
 */
export async function computeUserTasteProfile(userId: string): Promise<TasteVector | null> {
  const reviews = await prisma.review.findMany({
    where: { userId },
    include: { beer: true },
  });

  const weighted: { vector: TasteVector; weight: number }[] = reviews.map((r: Review & { beer: Beer }) => ({
    vector: tasteVector(r.beer),
    weight: r.rating,
  }));

  if (weighted.length === 0) {
    const scans = await prisma.scanHistory.findMany({
      where: { userId },
      include: { beer: true },
      distinct: ["beerId"],
    });
    weighted.push(...scans.map((s) => ({ vector: tasteVector(s.beer), weight: 3.5 })));
  }

  if (weighted.length === 0) return declaredPreference(userId);

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const profile = {} as TasteVector;
  for (const axis of AXES) {
    profile[axis] = Math.round(weighted.reduce((sum, w) => sum + w.vector[axis] * w.weight, 0) / totalWeight);
  }
  return profile;
}

type AxisWords = { low: string; high: string; lowTag: string; highTag: string };

const AXIS_WORDS: Record<keyof TasteVector, AxisWords> = {
  sweetness: { low: "Сухой", high: "Сладкий", lowTag: "Сухое", highTag: "Сладкое" },
  bitterness: { low: "Мягкий", high: "Хмелевой", lowTag: "Мягкая горечь", highTag: "Выраженная горечь" },
  sourness: { low: "Гладкий", high: "Кислый", lowTag: "Без кислинки", highTag: "С лёгкой кислинкой" },
  body: { low: "Лёгкий", high: "Плотный", lowTag: "Лёгкое тело", highTag: "Плотное тело" },
  aroma: { low: "Сдержанный", high: "Ароматный", lowTag: "Сдержанный аромат", highTag: "Яркий аромат хмеля" },
};

export type TastePersona = { title: string; tagline: string; category: string };

/** Two-word headline (bitterness + body, the two most defining beer traits). */
export function personaTitle(profile: TasteVector): string {
  const word = (axis: keyof TasteVector) => (profile[axis] >= 50 ? AXIS_WORDS[axis].high : AXIS_WORDS[axis].low);
  return `${word("bitterness")} & ${word("body")}`;
}

/**
 * Turns a taste vector into a short, Vivino-style "identity" — the headline
 * above, a tagline listing the rest, and a category flavored by the quiz's
 * "occasion" question.
 */
export function buildPersona(profile: TasteVector, occasion: "classic" | "adventurous"): TastePersona {
  const tag = (axis: keyof TasteVector) => (profile[axis] >= 50 ? AXIS_WORDS[axis].highTag : AXIS_WORDS[axis].lowTag);

  const tagline = (["sweetness", "sourness", "aroma"] as (keyof TasteVector)[]).map(tag).join(" · ");
  const category =
    occasion === "adventurous" ? "Для искателей нового вкуса" : "Для тех, кто любит проверенное";

  return { title: personaTitle(profile), tagline, category };
}

/**
 * Best-matching beer for a declared taste profile, factoring in a target
 * ABV from the quiz's strength question alongside the taste-vector match.
 */
export async function recommendBeerForProfile(profile: TasteVector, targetAbv: number) {
  const beers = await prisma.beer.findMany({ include: { brewery: true } });
  if (beers.length === 0) return null;

  let best = beers[0];
  let bestScore = -Infinity;
  for (const b of beers) {
    const score = matchPercent(profile, tasteVector(b)) - Math.abs(b.abv - targetAbv) * 3;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

export async function findSimilarBeers(beer: Beer, limit = 4) {
  const candidates = await prisma.beer.findMany({
    where: { id: { not: beer.id } },
    include: { brewery: true },
  });

  const target = tasteVector(beer);
  return candidates
    .map((c) => ({ beer: c, match: matchPercent(target, tasteVector(c)) }))
    .sort((a, b) => b.match - a.match)
    .slice(0, limit);
}
