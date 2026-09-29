import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeUserTasteProfile, findSimilarBeers, matchPercent, tasteVector } from "../lib/taste";
import { serializeBeerDetail } from "../lib/serialize";
import { recognizeLabel } from "../lib/mlRecognition";
import { lookupBarcode } from "../lib/openFoodFacts";
import { addBeerToCatalog } from "../lib/beerCatalog";

export const scanRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/**
 * Распознаёт отсканированное пиво. Порядок: штрихкод (наша база, затем Open Food Facts) →
 * фото этикетки через ML-сервис (см. /ml). Если ничего не нашли, честно отвечаем 404 с кодом
 * NOT_RECOGNIZED: приложение предложит найти пиво вручную или добавить его.
 * Для демонстрации без обученной модели можно включить SCAN_DEMO_MODE=1 — тогда вместо отказа
 * выдаётся случайное пиво из базы (на боевом сервере не включать).
 */
scanRouter.post("/", requireAuth, upload.single("photo"), async (req, res) => {
  const barcode = typeof req.body?.barcode === "string" ? req.body.barcode.trim() : undefined;

  let beer = barcode ? await prisma.beer.findUnique({ where: { barcode } }) : null;

  if (!beer && barcode) {
    const product = await lookupBarcode(barcode);
    if (product) {
      beer = (
        await addBeerToCatalog({
          name: product.name,
          breweryName: product.brand ?? "Не указана",
          country: product.country,
          style: product.style,
          abv: product.abv ?? 5,
          barcode,
          imageUrl: product.imageUrl,
          description: `${product.style}. Данные по штрихкоду из Open Food Facts${product.abv ? "" : "; крепость указана приблизительно"}. Вкус указан приблизительно, по типичному для стиля.`,
        })
      ).beer;
    }
  }

  // Кандидаты от ML, если уверенно не узнали: покажем пользователю «возможно, это…».
  let suggestions: { id: string; name: string; breweryName: string; style: string }[] = [];

  if (!beer && req.file) {
    const ml = await recognizeLabel(req.file.buffer);
    if (ml) {
      const found = [];
      for (const candidate of ml.candidates) {
        const match = await prisma.beer.findFirst({
          where: {
            name: candidate.beerName,
            ...(candidate.breweryName ? { brewery: { name: candidate.breweryName } } : {}),
          },
          include: { brewery: true },
        });
        if (match) found.push({ beer: match, confidence: candidate.confidence });
      }
      if (ml.recognized && found[0]) beer = found[0].beer;
      else suggestions = found.filter((f) => f.confidence >= 0.25).map((f) => ({
        id: f.beer.id, name: f.beer.name, breweryName: f.beer.brewery.name, style: f.beer.style,
      }));
    }
  }

  if (!beer && process.env.SCAN_DEMO_MODE === "1") {
    const count = await prisma.beer.count();
    if (count > 0) beer = await prisma.beer.findFirst({ skip: Math.floor(Math.random() * count) });
  }

  if (!beer) {
    return res.status(404).json({
      error: barcode ? "Этого пива пока нет в базе" : "Не удалось распознать пиво по фото",
      code: "NOT_RECOGNIZED",
      barcode: barcode ?? null,
      suggestions,
    });
  }

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
