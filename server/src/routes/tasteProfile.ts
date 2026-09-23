import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeUserTasteProfile } from "../lib/taste";

export const tasteProfileRouter = Router();

const quizSchema = z.object({
  bitterness: z.number().int().min(0).max(100),
  body: z.number().int().min(0).max(100),
  aroma: z.number().int().min(0).max(100),
});

// POST /taste-profile/quiz — saves the onboarding quiz's 3 answers as a
// declared taste preference, so a match% is available immediately, before
// the user has scanned or reviewed a single beer.
tasteProfileRouter.post("/quiz", requireAuth, async (req, res) => {
  const parsed = quizSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Некорректные ответы квиза" });

  await prisma.user.update({
    where: { id: req.userId! },
    data: {
      prefBitterness: parsed.data.bitterness,
      prefBody: parsed.data.body,
      prefAroma: parsed.data.aroma,
    },
  });

  const profile = await computeUserTasteProfile(req.userId!);
  res.json({ profile, favoriteStyle: null, beersScanned: 0, hasEnoughData: profile !== null });
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
