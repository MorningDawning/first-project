import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const barRouter = Router();

// GET /bar — user's beer-scanning history, most recent first.
barRouter.get("/", requireAuth, async (req, res) => {
  const scans = await prisma.scanHistory.findMany({
    where: { userId: req.userId },
    include: { beer: { include: { brewery: true } } },
    orderBy: { scannedAt: "desc" },
  });

  res.json(
    scans.map((s) => ({
      scanId: s.id,
      scannedAt: s.scannedAt,
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
