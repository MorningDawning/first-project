import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import { computeUserTasteProfile } from "../lib/taste";
import {
  areFriends,
  compareTaste,
  ensureUsername,
  friendIdsOf,
  isOnline,
  postInclude,
  relationTo,
  serializePost,
} from "../lib/social";

export const profilesRouter = Router();

// GET /users/:id — чужой профиль: совпадение вкуса со мной, статус дружбы, счётчики.
profilesRouter.get("/:id", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const found = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!found) return res.status(404).json({ error: "Пользователь не найден" });
  const user = await ensureUsername(found);

  const friends = await areFriends(me, user.id);
  const [relation, myFriendIds, theirFriendIds, scanCount, reviewCount, postCount, myProfile, theirProfile] =
    await Promise.all([
      relationTo(me, user.id),
      friendIdsOf(me),
      friendIdsOf(user.id),
      prisma.scanHistory.count({ where: { userId: user.id } }),
      prisma.review.count({ where: { userId: user.id } }),
      prisma.post.count({
        where: { userId: user.id, ...(friends || me === user.id ? {} : { visibility: "all" }) },
      }),
      computeUserTasteProfile(me),
      computeUserTasteProfile(user.id),
    ]);

  const mine = new Set(myFriendIds);
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    city: user.city,
    online: isOnline(user.lastSeenAt),
    relation,
    mutualFriends: theirFriendIds.filter((id) => mine.has(id)).length,
    stats: { friendCount: theirFriendIds.length, scanCount, reviewCount, postCount },
    taste: me !== user.id && myProfile && theirProfile ? compareTaste(myProfile, theirProfile, user.name) : null,
  });
}));

// GET /users/:id/bar — бар человека (бар открыт всем, как в макете).
profilesRouter.get("/:id/bar", requireAuth, wrap(async (req, res) => {
  const userId = req.params.id;
  const [scans, reviews] = await Promise.all([
    prisma.scanHistory.findMany({
      where: { userId },
      include: { beer: { include: { brewery: true } } },
      orderBy: { scannedAt: "desc" },
    }),
    prisma.review.findMany({ where: { userId } }),
  ]);
  const ratingByBeer = new Map(reviews.map((r) => [r.beerId, r.rating]));
  const seen = new Set<string>();
  res.json(
    scans
      .filter((s) => (seen.has(s.beerId) ? false : (seen.add(s.beerId), true)))
      .map((s) => ({
        beer: {
          id: s.beer.id,
          name: s.beer.name,
          style: s.beer.style,
          imageUrl: s.beer.imageUrl,
          brewery: { id: s.beer.brewery.id, name: s.beer.brewery.name },
        },
        rating: ratingByBeer.get(s.beerId) ?? null,
        scannedAt: s.scannedAt,
      }))
  );
}));

// GET /users/:id/posts — посты человека, которые я вправе видеть.
profilesRouter.get("/:id/posts", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const userId = req.params.id;
  const visible = me === userId || (await areFriends(me, userId));
  const [rows, profile] = await Promise.all([
    prisma.post.findMany({
      where: { userId, ...(visible ? {} : { visibility: "all" }) },
      include: postInclude(me),
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    computeUserTasteProfile(me),
  ]);
  res.json(rows.map((p) => serializePost(p, profile)));
}));

const reportSchema = z.object({ reason: z.string().trim().max(300).optional() });

profilesRouter.post("/:id/report", requireAuth, wrap(async (req, res) => {
  const parsed = reportSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Слишком длинная причина" });
  await prisma.report.create({
    data: { reporterId: req.userId!, targetType: "user", targetId: req.params.id, reason: parsed.data.reason },
  });
  res.status(201).json({ ok: true });
}));
