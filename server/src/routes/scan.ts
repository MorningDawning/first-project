import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeUserTasteProfile, findSimilarBeers, matchPercent, tasteVector } from "../lib/taste";
import { serializeBeerDetail } from "../lib/serialize";
import { recognizeLabel } from "../lib/mlRecognition";

export const scanRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/**
 * Recognizes a scanned beer label/can.
 *
 * Primary path: the uploaded photo goes to the CLIP recognition service
 * (see /ml — a linear-probe classifier fine-tuned on top of CLIP embeddings)
 * and we look up the match by name in our own database. Until a checkpoint
 * is trained on real photos (or if ML_SERVICE_URL isn't configured, or the
 * service is unreachable), falls back to a barcode lookup or a pseudo-random
 * pick, so the rest of the app — and manual testing — keeps working
 * end-to-end while the dataset is still being collected.
 */
scanRouter.post("/", requireAuth, upload.single("photo"), async (req, res) => {
  const barcode = req.body?.barcode as string | undefined;

  let beer = barcode ? await prisma.beer.findUnique({ where: { barcode } }) : null;

  if (!beer && req.file) {
    const candidate = await recognizeLabel(req.file.buffer);
    if (candidate) {
      beer = await prisma.beer.findFirst({ where: { name: candidate.beerName } });
    }
  }

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
