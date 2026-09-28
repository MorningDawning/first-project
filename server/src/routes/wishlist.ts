import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeUserTasteProfile, matchPercent, tasteVector } from "../lib/taste";
import { serializeBeer } from "../lib/serialize";

export const wishlistRouter = Router();

// GET /wishlist — beers the user bookmarked to try, most recently added first.
wishlistRouter.get("/", requireAuth, async (req, res) => {
  const entries = await prisma.wishlist.findMany({
    where: { userId: req.userId },
    include: { beer: { include: { brewery: true } } },
    orderBy: { createdAt: "desc" },
  });

  const profile = await computeUserTasteProfile(req.userId!);
  res.json(
    entries.map((e) =>
      serializeBeer(e.beer, profile ? matchPercent(profile, tasteVector(e.beer)) : null, true)
    )
  );
});

wishlistRouter.post("/:beerId", requireAuth, async (req, res) => {
  const beer = await prisma.beer.findUnique({ where: { id: req.params.beerId } });
  if (!beer) return res.status(404).json({ error: "Пиво не найдено" });

  await prisma.wishlist.upsert({
    where: { userId_beerId: { userId: req.userId!, beerId: beer.id } },
    update: {},
    create: { userId: req.userId!, beerId: beer.id },
  });

  res.status(201).json({ ok: true });
});

wishlistRouter.delete("/:beerId", requireAuth, async (req, res) => {
  await prisma.wishlist
    .delete({ where: { userId_beerId: { userId: req.userId!, beerId: req.params.beerId } } })
    .catch(() => {});

  res.json({ ok: true });
});
