import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const barRouter = Router();

// GET /bar — user's beer-scanning history, most recent first, with their own
// rating for each beer (if reviewed) so the app can filter to "Favorites".
barRouter.get("/", requireAuth, async (req, res) => {
  const scans = await prisma.scanHistory.findMany({
    where: { userId: req.userId },
    include: { beer: { include: { brewery: true } } },
    orderBy: { scannedAt: "desc" },
  });

  const reviews = await prisma.review.findMany({ where: { userId: req.userId } });
  const ratingByBeerId = new Map(reviews.map((r) => [r.beerId, r.rating]));

  res.json(
    scans.map((s) => ({
      scanId: s.id,
      scannedAt: s.scannedAt,
      rating: ratingByBeerId.get(s.beerId) ?? null,
      beer: {
        id: s.beer.id,
        name: s.beer.name,
        style: s.beer.style,
        imageUrl: s.beer.imageUrl,
        brewery: { id: s.beer.brewery.id, name: s.beer.brewery.name },
      },
    }))
  );
});
