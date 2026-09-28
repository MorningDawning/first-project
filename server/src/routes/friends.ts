import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import { computeUserTasteProfile, matchPercent } from "../lib/taste";
import { friendIdsOf, isOnline, mutualFriendCounts, relationTo, userBrief } from "../lib/social";

export const friendsRouter = Router();

async function matchWithMe(myProfile: Awaited<ReturnType<typeof computeUserTasteProfile>>, userId: string) {
  if (!myProfile) return null;
  const theirs = await computeUserTasteProfile(userId);
  return theirs ? matchPercent(myProfile, theirs) : null;
}

// GET /friends — мои друзья.
friendsRouter.get("/", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const ids = await friendIdsOf(me);
  const [users, myProfile] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    computeUserTasteProfile(me),
  ]);
  const matches = await Promise.all(users.map((u) => matchWithMe(myProfile, u.id)));
  res.json(users.map((u, i) => ({ ...userBrief(u), match: matches[i], online: isOnline(u.lastSeenAt) })));
}));

// GET /friends/requests — входящие заявки.
friendsRouter.get("/requests", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const rows = await prisma.friendship.findMany({
    where: { friendId: me, status: "pending" },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  const [myProfile, friendIds] = await Promise.all([computeUserTasteProfile(me), friendIdsOf(me)]);
  const mutual = await mutualFriendCounts(new Set(friendIds), rows.map((r) => r.userId));
  const matches = await Promise.all(rows.map((r) => matchWithMe(myProfile, r.userId)));
  res.json(
    rows.map((r, i) => ({
      requestId: r.id,
      createdAt: r.createdAt,
      user: userBrief(r.user),
      match: matches[i],
      mutualFriends: mutual.get(r.userId) ?? 0,
    }))
  );
}));

const requestSchema = z.object({ userId: z.string().min(1) });

// POST /friends/requests — отправить заявку. Если человек уже звал меня — сразу дружим.
friendsRouter.post("/requests", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Не указан пользователь" });
  const { userId: other } = parsed.data;
  if (other === me) return res.status(400).json({ error: "Нельзя добавить в друзья самого себя" });
  if (!(await prisma.user.findUnique({ where: { id: other } }))) {
    return res.status(404).json({ error: "Пользователь не найден" });
  }

  const rel = await relationTo(me, other);
  if (rel.status === "friends" || rel.status === "outgoing") return res.json({ status: rel.status });
  if (rel.status === "incoming") {
    await prisma.friendship.update({ where: { id: rel.requestId! }, data: { status: "accepted" } });
    return res.json({ status: "friends" });
  }
  await prisma.friendship.create({ data: { userId: me, friendId: other, status: "pending" } });
  res.status(201).json({ status: "outgoing" });
}));

friendsRouter.post("/requests/:id/accept", requireAuth, wrap(async (req, res) => {
  const row = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!row || row.friendId !== req.userId || row.status !== "pending") {
    return res.status(404).json({ error: "Заявка не найдена" });
  }
  await prisma.friendship.update({ where: { id: row.id }, data: { status: "accepted" } });
  res.json({ status: "friends" });
}));

friendsRouter.post("/requests/:id/decline", requireAuth, wrap(async (req, res) => {
  const row = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!row || row.friendId !== req.userId || row.status !== "pending") {
    return res.status(404).json({ error: "Заявка не найдена" });
  }
  await prisma.friendship.delete({ where: { id: row.id } });
  res.json({ status: "none" });
}));

// DELETE /friends/:userId — убрать из друзей или отозвать свою заявку.
// Чужую входящую заявку этим методом не снести — для неё есть decline.
friendsRouter.delete("/:userId", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const other = req.params.userId;
  await prisma.friendship.deleteMany({
    where: { OR: [{ userId: me, friendId: other }, { userId: other, friendId: me, status: "accepted" }] },
  });
  res.json({ status: "none" });
}));
