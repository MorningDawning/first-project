import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeUserTasteProfile, findSimilarBeers, matchPercent, tasteVector } from "../lib/taste";
import { serializeBeerDetail } from "../lib/serialize";

export const scanRouter = Router();

/**
 * Simulates label/can recognition. Real scanning would send an image or a
 * decoded barcode here; for now we either look up by barcode (if provided
 * by a real barcode scanner already wired into the client) or pick a beer
 * pseudo-randomly, standing in for an ML recognition service.
 */
scanRouter.post("/", requireAuth, async (req, res) => {
  const barcode = req.body?.barcode as string | undefined;

  let beer = barcode ? await prisma.beer.findUnique({ where: { barcode } }) : null;

  if (!beer) {
    const count = await prisma.beer.count();
    if (count === 0) return res.status(404).json({ error: "База пива пуста" });
    const skip = Math.floor(Math.random() * count);
    beer = await prisma.beer.findFirst({ skip });
  }

  if (!beer) return res.status(404).json({ error: "Не удалось распознать пиво" });

  await prisma.scanHistory.create({ data: { userId: req.userId!, beerId: beer.id } });

  const full = await prisma.beer.findUnique({
    where: { id: beer.id },
    include: { brewery: true, reviews: { include: { user: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!full) return res.status(404).json({ error: "Пиво не найдено" });

  const profile = await computeUserTasteProfile(req.userId!);
  const match = profile ? matchPercent(profile, tasteVector(full)) : null;
  const similar = await findSimilarBeers(full, 4);

  res.status(201).json(serializeBeerDetail(full, match, similar));
});
