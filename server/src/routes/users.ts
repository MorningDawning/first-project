import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  const [scanCount, reviewCount] = await Promise.all([
    prisma.scanHistory.count({ where: { userId: user.id } }),
    prisma.review.count({ where: { userId: user.id } }),
  ]);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    stats: { scanCount, reviewCount },
  });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().url().optional(),
});

usersRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Некорректные данные профиля" });

  const user = await prisma.user.update({ where: { id: req.userId }, data: parsed.data });
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, bio: user.bio });
});
