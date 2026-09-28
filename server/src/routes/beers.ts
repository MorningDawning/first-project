import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeUserTasteProfile, findSimilarBeers, matchPercent, tasteVector } from "../lib/taste";
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
  const wishlisted = await prisma.wishlist.findMany({ where: { userId: req.userId! }, select: { beerId: true } });
  const wishlistedIds = new Set(wishlisted.map((w) => w.beerId));

  res.json(
    beers.map((b) =>
      serializeBeer(b, profile ? matchPercent(profile, tasteVector(b)) : null, wishlistedIds.has(b.id))
    )
  );
});

beersRouter.get("/styles", requireAuth, async (_req, res) => {
  const beers = await prisma.beer.findMany({ select: { style: true }, distinct: ["style"] });
  res.json(beers.map((b) => b.style).sort());
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
  const isWishlisted =
    (await prisma.wishlist.findUnique({
      where: { userId_beerId: { userId: req.userId!, beerId: beer.id } },
    })) !== null;

  res.json(
    serializeBeerDetail(beer, profile ? matchPercent(profile, tasteVector(beer)) : null, similar, isWishlisted)
  );
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

beersRouter.post("/:id/reviews", requireAuth, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Рейтинг должен быть от 1 до 5" });

  const beer = await prisma.beer.findUnique({ where: { id: req.params.id } });
  if (!beer) return res.status(404).json({ error: "Пиво не найдено" });

  const { tags, ...rest } = parsed.data;
  const data = { ...rest, tags: JSON.stringify(tags ?? []) };

  const review = await prisma.review.upsert({
    where: { beerId_userId: { beerId: beer.id, userId: req.userId! } },
    update: data,
    create: { ...data, beerId: beer.id, userId: req.userId! },
  });

  res.status(201).json({ ...review, tags: JSON.parse(review.tags) });
});
