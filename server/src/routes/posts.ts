import fs from "fs";
import path from "path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import { Prisma } from "@prisma/client";
import { TasteVector, computeUserTasteProfile, matchPercent, tasteVector } from "../lib/taste";
import {
  canViewPost,
  friendIdsOf,
  mutualFriendCounts,
  postInclude,
  relationTo,
  serializePost,
  userBrief,
} from "../lib/social";
import { UPLOADS_DIR } from "./uploads";

export const postsRouter = Router();
export const commentsRouter = Router();

// GET /posts/:id — один пост + кто автор для меня (друг / можно позвать в друзья).
postsRouter.get("/:id", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: postInclude(me) });
  if (!post || !(await canViewPost(me, post))) return res.status(404).json({ error: "Пост не найден" });

  const [profile, relation, friendIds] = await Promise.all([
    computeUserTasteProfile(me),
    relationTo(me, post.userId),
    friendIdsOf(me),
  ]);
  const mutual = (await mutualFriendCounts(new Set(friendIds), [post.userId])).get(post.userId) ?? 0;
  res.json({
    ...serializePost(post, profile),
    author: { friendStatus: relation.status, requestId: relation.requestId, mutualFriends: mutual },
    canDelete: post.userId === me,
  });
}));

postsRouter.delete("/:id", requireAuth, wrap(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || post.userId !== req.userId) return res.status(404).json({ error: "Пост не найден" });
  await prisma.post.delete({ where: { id: post.id } });

  for (const url of JSON.parse(post.photos) as string[]) {
    const file = path.join(UPLOADS_DIR, path.relative("/uploads", url));
    if (file.startsWith(UPLOADS_DIR)) fs.promises.unlink(file).catch(() => {});
  }
  res.json({ ok: true });
}));

async function likeState(postId: string, me: string) {
  const [likeCount, mine] = await Promise.all([
    prisma.postLike.count({ where: { postId } }),
    prisma.postLike.findUnique({ where: { postId_userId: { postId, userId: me } } }),
  ]);
  return { likeCount, likedByMe: mine !== null };
}

postsRouter.post("/:id/like", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !(await canViewPost(me, post))) return res.status(404).json({ error: "Пост не найден" });
  await prisma.postLike.upsert({
    where: { postId_userId: { postId: post.id, userId: me } },
    update: {},
    create: { postId: post.id, userId: me },
  });
  res.json(await likeState(post.id, me));
}));

postsRouter.delete("/:id/like", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  await prisma.postLike.deleteMany({ where: { postId: req.params.id, userId: me } });
  res.json(await likeState(req.params.id, me));
}));

const commentInclude = (me: string) =>
  ({
    user: true,
    beer: { include: { brewery: true } },
    _count: { select: { likes: true } },
    likes: { where: { userId: me }, select: { userId: true } },
  }) as const;

type CommentRow = Prisma.CommentGetPayload<{ include: ReturnType<typeof commentInclude> }>;

function serializeComment(c: CommentRow, me: string, postOwnerId: string, profile: TasteVector | null) {
  return {
    id: c.id,
    text: c.text,
    createdAt: c.createdAt,
    parentId: c.parentId,
    user: userBrief(c.user),
    photo: c.photoUrl ? { url: c.photoUrl, width: c.photoWidth, height: c.photoHeight } : null,
    beer: c.beer
      ? {
          id: c.beer.id,
          name: c.beer.name,
          style: c.beer.style,
          imageUrl: c.beer.imageUrl,
          brewery: { id: c.beer.brewery.id, name: c.beer.brewery.name },
          matchPercent: profile ? matchPercent(profile, tasteVector(c.beer)) : null,
        }
      : null,
    likeCount: c._count.likes,
    likedByMe: c.likes.length > 0,
    canDelete: c.userId === me || postOwnerId === me,
  };
}

// GET /posts/:id/comments — плоский список: комментарий, сразу за ним его ответы.
postsRouter.get("/:id/comments", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !(await canViewPost(me, post))) return res.status(404).json({ error: "Пост не найден" });

  const [rows, profile] = await Promise.all([
    prisma.comment.findMany({ where: { postId: post.id }, include: commentInclude(me), orderBy: { createdAt: "asc" } }),
    computeUserTasteProfile(me),
  ]);
  const serialize = (c: CommentRow) => serializeComment(c, me, post.userId, profile);
  const roots = rows.filter((c) => !c.parentId);
  res.json(roots.flatMap((root) => [serialize(root), ...rows.filter((c) => c.parentId === root.id).map(serialize)]));
}));

const commentSchema = z
  .object({
    text: z.string().trim().max(500).optional(),
    parentId: z.string().optional(),
    beerId: z.string().optional(),
    photo: z
      .object({
        url: z.string(),
        width: z.number().int().min(1).max(20000).optional(),
        height: z.number().int().min(1).max(20000).optional(),
      })
      .optional(),
  })
  .refine((v) => (v.text && v.text.length > 0) || v.beerId || v.photo, { message: "empty" });

postsRouter.post("/:id/comments", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Напишите комментарий (до 500 символов), приложите фото или пиво" });
  const { text, beerId, photo } = parsed.data;

  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !(await canViewPost(me, post))) return res.status(404).json({ error: "Пост не найден" });

  if (beerId && !(await prisma.beer.findUnique({ where: { id: beerId } }))) {
    return res.status(404).json({ error: "Пиво не найдено" });
  }
  // Фото принимаем только из собственных загрузок.
  if (photo && !new RegExp(`^/uploads/${me}/[a-f0-9]{24}\\.(jpg|png|webp)$`).test(photo.url)) {
    return res.status(400).json({ error: "Некорректное фото" });
  }

  // Один уровень вложенности: ответ на ответ привязываем к корневому комментарию.
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.postId !== post.id) return res.status(404).json({ error: "Комментарий не найден" });
    parentId = parent.parentId ?? parent.id;
  }

  const comment = await prisma.comment.create({
    data: {
      postId: post.id,
      userId: me,
      parentId,
      text: text ?? "",
      beerId: beerId ?? null,
      photoUrl: photo?.url ?? null,
      photoWidth: photo?.width ?? null,
      photoHeight: photo?.height ?? null,
    },
    include: commentInclude(me),
  });
  res.status(201).json(serializeComment(comment, me, post.userId, await computeUserTasteProfile(me)));
}));

const reportSchema = z.object({ reason: z.string().trim().max(300).optional() });

postsRouter.post("/:id/report", requireAuth, wrap(async (req, res) => {
  const parsed = reportSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Слишком длинная причина" });
  await prisma.report.create({
    data: { reporterId: req.userId!, targetType: "post", targetId: req.params.id, reason: parsed.data.reason },
  });
  res.status(201).json({ ok: true });
}));

// ---------- comments ----------

async function commentLikeState(commentId: string, me: string) {
  const [likeCount, mine] = await Promise.all([
    prisma.commentLike.count({ where: { commentId } }),
    prisma.commentLike.findUnique({ where: { commentId_userId: { commentId, userId: me } } }),
  ]);
  return { likeCount, likedByMe: mine !== null };
}

commentsRouter.post("/:id/like", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id }, include: { post: true } });
  if (!comment || !(await canViewPost(me, comment.post))) return res.status(404).json({ error: "Комментарий не найден" });
  await prisma.commentLike.upsert({
    where: { commentId_userId: { commentId: comment.id, userId: me } },
    update: {},
    create: { commentId: comment.id, userId: me },
  });
  res.json(await commentLikeState(comment.id, me));
}));

commentsRouter.delete("/:id/like", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  await prisma.commentLike.deleteMany({ where: { commentId: req.params.id, userId: me } });
  res.json(await commentLikeState(req.params.id, me));
}));

commentsRouter.delete("/:id", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id }, include: { post: true } });
  if (!comment || (comment.userId !== me && comment.post.userId !== me)) {
    return res.status(404).json({ error: "Комментарий не найден" });
  }
  await prisma.comment.delete({ where: { id: comment.id } });
  if (comment.photoUrl) {
    const file = path.join(UPLOADS_DIR, path.relative("/uploads", comment.photoUrl));
    if (file.startsWith(UPLOADS_DIR)) fs.promises.unlink(file).catch(() => {});
  }
  res.json({ ok: true });
}));
