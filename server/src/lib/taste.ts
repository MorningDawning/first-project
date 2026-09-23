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
 * Aggregates a user's taste profile from their reviews (weighted by rating),
 * falling back to scan history (implicit neutral-positive weight) when they
 * haven't rated anything yet. Returns null if the user has no signal at all.
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

  if (weighted.length === 0) return null;

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const profile = {} as TasteVector;
  for (const axis of AXES) {
    profile[axis] = Math.round(weighted.reduce((sum, w) => sum + w.vector[axis] * w.weight, 0) / totalWeight);
  }
  return profile;
}

function distance(a: TasteVector, b: TasteVector): number {
  return AXES.reduce((sum, axis) => sum + Math.abs(a[axis] - b[axis]), 0);
}

/**
 * Greedy farthest-point sampling: picks `count` beers that spread as widely
 * as possible across the taste space, for the onboarding quiz — rating a
 * spiky IPA, a sour, a stout and a lager tells us a lot more about someone's
 * palate than rating four beers that all taste roughly the same.
 */
export function pickDiverseBeers<T extends Beer>(beers: T[], count: number): T[] {
  if (beers.length <= count) return beers;

  const remaining = [...beers];
  const picked: T[] = [remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]];

  while (picked.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestMinDistance = -1;

    remaining.forEach((candidate, index) => {
      const minDistance = Math.min(...picked.map((p) => distance(tasteVector(candidate), tasteVector(p))));
      if (minDistance > bestMinDistance) {
        bestMinDistance = minDistance;
        bestIndex = index;
      }
    });

    picked.push(remaining.splice(bestIndex, 1)[0]);
  }

  return picked;
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
