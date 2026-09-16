import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeUserTasteProfile } from "../lib/taste";

export const tasteProfileRouter = Router();

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
