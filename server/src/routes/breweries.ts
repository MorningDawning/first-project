import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const breweriesRouter = Router();

// GET /breweries — worldwide brewery library.
breweriesRouter.get("/", requireAuth, async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();

  const breweries = await prisma.brewery.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { country: { contains: q } }] } : undefined,
    include: { _count: { select: { beers: true } } },
    orderBy: { name: "asc" },
  });

  res.json(
    breweries.map((b) => ({
      id: b.id,
      name: b.name,
      country: b.country,
      city: b.city,
      description: b.description,
      logoUrl: b.logoUrl,
      beerCount: b._count.beers,
    }))
  );
});

breweriesRouter.get("/:id", requireAuth, async (req, res) => {
  const brewery = await prisma.brewery.findUnique({
    where: { id: req.params.id },
    include: { beers: true },
  });
  if (!brewery) return res.status(404).json({ error: "Пивоварня не найдена" });

  res.json({
    id: brewery.id,
    name: brewery.name,
    country: brewery.country,
    city: brewery.city,
    description: brewery.description,
    logoUrl: brewery.logoUrl,
    beers: brewery.beers.map((b) => ({ id: b.id, name: b.name, style: b.style, imageUrl: b.imageUrl })),
  });
});
