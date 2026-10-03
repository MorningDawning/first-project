import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { recalcBeerTaste } from "../lib/crowdTaste";
import { computeUserTasteProfile, findSimilarBeers, matchPercent, tasteVector } from "../lib/taste";
import { serializeBeer, serializeBeerDetail } from "../lib/serialize";
import { fold } from "../lib/text";
import { addBeerToCatalog } from "../lib/beerCatalog";

export const beersRouter = Router();

// GET /beers?q=search&style=IPA
// Поиск делаем в коде, а не в базе: база не умеет сравнивать русские буквы без учёта регистра.
beersRouter.get("/", requireAuth, async (req, res) => {
  const q = fold((req.query.q as string | undefined) ?? "");
  const style = req.query.style as string | undefined;

  const all = await prisma.beer.findMany({
    where: style ? { style } : {},
    include: { brewery: true },
    orderBy: { name: "asc" },
  });
  const beers = q
    ? all.filter((b) => [b.name, b.brewery.name, b.style].some((field) => fold(field).includes(q)))
    : all;

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
  // Самые популярные стили первыми — так ряд чипов на Главной начинается с IPA, а не с алфавита.
  const groups = await prisma.beer.groupBy({ by: ["style"], _count: { style: true } });
  groups.sort((a, b) => b._count.style - a._count.style || a.style.localeCompare(b.style));
  res.json(groups.map((g) => g.style));
});

const newBeerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  breweryName: z.string().trim().min(2).max(60),
  style: z.string().trim().min(2).max(40),
  abv: z.number().min(0).max(25),
  barcode: z.string().regex(/^\d{6,14}$/).optional(),
});

// POST /beers — добавить пиво, которого нет в каталоге (например, после неудачного скана).
// Если такое уже есть, вернёт существующее. Если пришёл штрихкод, пиво попадает и в бар пользователя.
beersRouter.post("/", requireAuth, async (req, res) => {
  const parsed = newBeerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Проверьте название, пивоварню, стиль и крепость (0–25%)" });
  }
  const { beer, created } = await addBeerToCatalog({ ...parsed.data, abv: Math.round(parsed.data.abv * 10) / 10 });
  if (parsed.data.barcode) {
    await prisma.scanHistory.create({ data: { userId: req.userId!, beerId: beer.id } });
  }
  res.status(created ? 201 : 200).json({ id: beer.id, created });
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

  await recalcBeerTaste(beer.id);

  res.status(201).json({ ...review, tags: JSON.parse(review.tags) });
});
