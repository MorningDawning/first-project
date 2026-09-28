import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { USERNAME_RE, ensureUsername } from "../lib/social";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, async (req, res) => {
  const found = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!found) return res.status(404).json({ error: "Пользователь не найден" });
  const user = await ensureUsername(found);

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
    username: user.username,
    city: user.city,
    createdAt: user.createdAt,
    stats: { scanCount, reviewCount },
  });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().url().optional(),
  username: z.string().regex(USERNAME_RE).optional(),
  city: z.string().trim().max(40).optional(),
});

usersRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Некорректные данные профиля" });

  const { username, ...rest } = parsed.data;
  if (username) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken && taken.id !== req.userId) return res.status(409).json({ error: "Это имя пользователя уже занято" });
  }
  const user = await prisma.user.update({ where: { id: req.userId }, data: { ...rest, ...(username ? { username } : {}) } });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    username: user.username,
    city: user.city,
  });
});
