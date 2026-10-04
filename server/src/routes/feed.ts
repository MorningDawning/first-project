import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import { computeUserTasteProfile, matchPercent, tasteVector } from "../lib/taste";
import { friendIdsOf, mutualFriendCounts, postInclude, relationsTo, serializePost, userBrief } from "../lib/social";

export const feedRouter = Router();

const PAGE = 30;

// GET /feed?tab=friends|foryou&before=<ISO>
// friends — посты меня и друзей, от новых к старым (с пагинацией по before).
// foryou  — публичные посты незнакомых, выше те, где пиво ближе к моему вкусу.
feedRouter.get("/", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const tab = req.query.tab === "foryou" ? "foryou" : "friends";
  const [profile, friendIds] = await Promise.all([computeUserTasteProfile(me), friendIdsOf(me)]);

  if (tab === "friends") {
    const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;
    const rows = await prisma.post.findMany({
      where: {
        userId: { in: [me, ...friendIds] },
        ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
      },
      include: postInclude(me),
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
    });
    const page = rows.slice(0, PAGE);
    return res.json({
      posts: page.map((p) => serializePost(p, profile)),
      nextBefore: rows.length > PAGE ? page[page.length - 1].createdAt : null,
    });
  }

  const rows = await prisma.post.findMany({
    where: { visibility: "all", userId: { notIn: [me, ...friendIds] } },
    include: postInclude(me),
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const top = rows
    .map((p) => {
      const ageHours = (Date.now() - p.createdAt.getTime()) / 3_600_000;
      const match = p.beer && profile ? matchPercent(profile, tasteVector(p.beer)) : 50;
      return { p, score: match + 20 * Math.exp(-ageHours / 48) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, PAGE)
    .map((x) => x.p);

  const authorIds = [...new Set(top.map((p) => p.userId))];
  const [relations, mutual] = await Promise.all([
    relationsTo(me, authorIds),
    mutualFriendCounts(new Set(friendIds), authorIds),
  ]);
  res.json({
    posts: top.map((p) => ({
      ...serializePost(p, profile),
      author: { friendStatus: relations.get(p.userId)!.status, mutualFriends: mutual.get(p.userId) ?? 0 },
    })),
    nextBefore: null,
  });
}));

// GET /feed/people — люди с похожим вкусом (для вкладки «Для тебя»).
feedRouter.get("/people", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const myProfile = await computeUserTasteProfile(me);
  if (!myProfile) return res.json([]);

  const friendIds = await friendIdsOf(me);
  const candidates = await prisma.user.findMany({
    where: { id: { notIn: [me, ...friendIds] } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const profiles = await Promise.all(candidates.map((u) => computeUserTasteProfile(u.id)));
  const scored = candidates
    .map((u, i) => ({ u, match: profiles[i] ? matchPercent(myProfile, profiles[i]!) : null }))
    .filter((x): x is { u: (typeof candidates)[number]; match: number } => x.match !== null)
    .sort((a, b) => b.match - a.match)
    .slice(0, 10);

  const relations = await relationsTo(me, scored.map((x) => x.u.id));
  res.json(
    scored.map(({ u, match }) => ({
      user: userBrief(u),
      match,
      friendStatus: relations.get(u.id)!.status,
      requestId: relations.get(u.id)!.requestId,
    }))
  );
}));

const createSchema = z.object({
  text: z.string().trim().min(1).max(500),
  beerId: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  place: z.string().trim().max(80).optional(),
  visibility: z.enum(["friends", "all"]).default("friends"),
  photos: z.array(z.string()).max(3).default([]),
});

// POST /feed — новый пост. Пиво с оценкой одновременно становится отзывом.
feedRouter.post("/", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Напишите текст поста (до 500 символов)" });
  const { text, beerId, rating, place, visibility, photos } = parsed.data;

  if (rating && !beerId) return res.status(400).json({ error: "Оценку можно поставить только пиву" });
  const photoRe = new RegExp(`^/uploads/${me}/[a-f0-9]{24}\\.(jpg|png|webp)$`);
  if (!photos.every((p) => photoRe.test(p))) return res.status(400).json({ error: "Некорректные фото" });

  if (beerId) {
    const beer = await prisma.beer.findUnique({ where: { id: beerId } });
    if (!beer) return res.status(404).json({ error: "Пиво не найдено" });
  }

  const post = await prisma.post.create({
    data: {
      userId: me,
      text,
      beerId: beerId ?? null,
      rating: rating ?? null,
      place: place || null,
      visibility,
      photos: JSON.stringify(photos),
    },
    include: postInclude(me),
  });

  if (beerId && rating) {
    await prisma.review.upsert({
      where: { beerId_userId: { beerId, userId: me } },
      update: { rating, text },
      create: { beerId, userId: me, rating, text, tags: "[]" },
    });
  }

  res.status(201).json(serializePost(post, await computeUserTasteProfile(me)));
}));
