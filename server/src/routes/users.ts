import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireAuthAnyAge, forgetAuthCheck } from "../middleware/auth";
import { comparePassword } from "../lib/auth";
import { UNDERAGE_MESSAGE, isAdult, parseBirthDate } from "../lib/age";
import { deleteAccount } from "../lib/accountDeletion";
import { USERNAME_RE, ensureUsername } from "../lib/social";

export const usersRouter = Router();

usersRouter.get("/me", requireAuthAnyAge, async (req, res) => {
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
    ageConfirmed: user.birthDate !== null,
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

// POST /me/age — подтверждение возраста для аккаунтов, созданных до появления ограничения 18+.
// Дату рождения сохраняем только если человек совершеннолетний: отказ ничего не записывает.
usersRouter.post("/me/age", requireAuthAnyAge, async (req, res) => {
  const parsed = z.object({ birthDate: z.string(), acceptTerms: z.literal(true) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Укажите дату рождения и согласие с политикой" });
  const birthDate = parseBirthDate(parsed.data.birthDate);
  if (!birthDate) return res.status(400).json({ error: "Проверьте дату рождения" });
  if (!isAdult(birthDate)) return res.status(403).json({ error: UNDERAGE_MESSAGE, code: "underage" });

  await prisma.user.update({ where: { id: req.userId }, data: { birthDate, termsAcceptedAt: new Date() } });
  forgetAuthCheck(req.userId!);
  res.json({ ok: true });
});

// DELETE /me — удаление аккаунта и всего, что с ним связано. Нужен пароль: чужой телефон или украденный токен
// не должны позволять стереть аккаунт.
usersRouter.delete("/me", requireAuthAnyAge, async (req, res) => {
  const parsed = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Введите пароль для подтверждения" });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  if (!(await comparePassword(parsed.data.password, user.passwordHash))) {
    return res.status(403).json({ error: "Неверный пароль" });
  }
  await deleteAccount(user.id);
  forgetAuthCheck(user.id);
  res.json({ ok: true });
});
