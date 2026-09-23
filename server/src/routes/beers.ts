import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeUserTasteProfile, findSimilarBeers, matchPercent, pickDiverseBeers, tasteVector } from "../lib/taste";
import { serializeBeer, serializeBeerDetail } from "../lib/serialize";

export const beersRouter = Router();

// GET /beers?q=search&style=IPA
beersRouter.get("/", requireAuth, async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const style = req.query.style as string | undefined;

  const beers = await prisma.beer.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q } },
                { brewery: { name: { contains: q } } },
                { style: { contains: q } },
              ],
            }
          : {},
        style ? { style } : {},
      ],
    },
    include: { brewery: true },
    orderBy: { name: "asc" },
  });

  const profile = await computeUserTasteProfile(req.userId!);
  res.json(
    beers.map((b) => serializeBeer(b, profile ? matchPercent(profile, tasteVector(b)) : null))
  );
});

beersRouter.get("/styles", requireAuth, async (_req, res) => {
  const beers = await prisma.beer.findMany({ select: { style: true }, distinct: ["style"] });
  res.json(beers.map((b) => b.style).sort());
});

// GET /beers/onboarding — a handful of beers picked to span the taste space
// as widely as possible, for the "rate a few to get started" taste quiz.
beersRouter.get("/onboarding", requireAuth, async (_req, res) => {
  const beers = await prisma.beer.findMany({ include: { brewery: true } });
  const picks = pickDiverseBeers(beers, 6);
  res.json(picks.map((b) => serializeBeer(b, null)));
});

beersRouter.get("/:id", requireAuth, async (req, res) => {
  const beer = await prisma.beer.findUnique({
    where: { id: req.params.id },
    include: {
      brewery: true,
      reviews: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!beer) return res.status(404).json({ error: "Пиво не найдено" });

  const profile = await computeUserTasteProfile(req.userId!);
  const similar = await findSimilarBeers(beer, 4);

  res.json(serializeBeerDetail(beer, profile ? matchPercent(profile, tasteVector(beer)) : null, similar));
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(1000).optional(),
});

beersRouter.post("/:id/reviews", requireAuth, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Рейтинг должен быть от 1 до 5" });

  const beer = await prisma.beer.findUnique({ where: { id: req.params.id } });
  if (!beer) return res.status(404).json({ error: "Пиво не найдено" });

  const review = await prisma.review.upsert({
    where: { beerId_userId: { beerId: beer.id, userId: req.userId! } },
    update: parsed.data,
    create: { ...parsed.data, beerId: beer.id, userId: req.userId! },
  });

  res.status(201).json(review);
});
