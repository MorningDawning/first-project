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

// POST /bar/:beerId — manually log a beer without going through the scanner
// (e.g. "В мой бар" from the beer detail page). Same ScanHistory row a real
// scan would create.
barRouter.post("/:beerId", requireAuth, async (req, res) => {
  const beer = await prisma.beer.findUnique({ where: { id: req.params.beerId } });
  if (!beer) return res.status(404).json({ error: "Пиво не найдено" });

  await prisma.scanHistory.create({ data: { userId: req.userId!, beerId: beer.id } });
  res.status(201).json({ ok: true });
});
