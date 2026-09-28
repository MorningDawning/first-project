import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { buildPersona, computeUserTasteProfile, matchPercent, recommendBeerForProfile, tasteVector } from "../lib/taste";
import { serializeBeer } from "../lib/serialize";

export const tasteProfileRouter = Router();

const quizSchema = z.object({
  bitterness: z.number().int().min(0).max(100),
  body: z.number().int().min(0).max(100),
  aroma: z.number().int().min(0).max(100),
  sweetness: z.number().int().min(0).max(100),
  sourness: z.number().int().min(0).max(100),
  targetAbv: z.number().min(0).max(20),
  occasion: z.enum(["classic", "adventurous"]),
});

// POST /taste-profile/quiz — saves the onboarding quiz's answers as a
// declared taste preference (so a match% is available immediately, before
// the user has scanned or reviewed a single beer), and returns a Vivino-
// style "taste identity": a headline + tagline built from the profile, plus
// the single beer in the catalog that fits it best.
tasteProfileRouter.post("/quiz", requireAuth, async (req, res) => {
  const parsed = quizSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Некорректные ответы квиза" });

  await prisma.user.update({
    where: { id: req.userId! },
    data: {
      prefBitterness: parsed.data.bitterness,
      prefBody: parsed.data.body,
      prefAroma: parsed.data.aroma,
      prefSweetness: parsed.data.sweetness,
      prefSourness: parsed.data.sourness,
    },
  });

  const profile = await computeUserTasteProfile(req.userId!);
  if (!profile) return res.status(500).json({ error: "Не удалось построить профиль" });

  const persona = buildPersona(profile, parsed.data.occasion);
  const recommendedBeer = await recommendBeerForProfile(profile, parsed.data.targetAbv);

  res.json({
    profile,
    persona,
    recommendedBeer: recommendedBeer
      ? serializeBeer(recommendedBeer, matchPercent(profile, tasteVector(recommendedBeer)))
      : null,
  });
});

// GET /taste-profile — aggregated taste vector + favorite style, built from
// the user's reviews (falling back to scan history) for the profile screen.
tasteProfileRouter.get("/", requireAuth, async (req, res) => {
  const profile = await computeUserTasteProfile(req.userId!);

  const scans = await prisma.scanHistory.findMany({
    where: { userId: req.userId },
    include: { beer: true },
  });

  const styleCounts = new Map<string, number>();
  for (const s of scans) {
    styleCounts.set(s.beer.style, (styleCounts.get(s.beer.style) ?? 0) + 1);
  }
  const favoriteStyle =
    [...styleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  res.json({
    profile,
    favoriteStyle,
    beersScanned: new Set(scans.map((s) => s.beerId)).size,
    hasEnoughData: profile !== null,
  });
});
