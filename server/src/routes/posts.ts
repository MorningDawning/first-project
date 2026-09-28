import fs from "fs";
import path from "path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import { computeUserTasteProfile } from "../lib/taste";
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

// GET /posts/:id/comments — плоский список: комментарий, сразу за ним его ответы.
postsRouter.get("/:id/comments", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !(await canViewPost(me, post))) return res.status(404).json({ error: "Пост не найден" });

  const rows = await prisma.comment.findMany({
    where: { postId: post.id },
    include: {
      user: true,
      _count: { select: { likes: true } },
      likes: { where: { userId: me }, select: { userId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const serialize = (c: (typeof rows)[number]) => ({
    id: c.id,
    text: c.text,
    createdAt: c.createdAt,
    parentId: c.parentId,
    user: userBrief(c.user),
    likeCount: c._count.likes,
    likedByMe: c.likes.length > 0,
    canDelete: c.userId === me || post.userId === me,
  });
  const roots = rows.filter((c) => !c.parentId);
  res.json(roots.flatMap((root) => [serialize(root), ...rows.filter((c) => c.parentId === root.id).map(serialize)]));
}));

const commentSchema = z.object({ text: z.string().trim().min(1).max(500), parentId: z.string().optional() });

postsRouter.post("/:id/comments", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Напишите комментарий (до 500 символов)" });

  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !(await canViewPost(me, post))) return res.status(404).json({ error: "Пост не найден" });

  // Один уровень вложенности: ответ на ответ привязываем к корневому комментарию.
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.postId !== post.id) return res.status(404).json({ error: "Комментарий не найден" });
    parentId = parent.parentId ?? parent.id;
  }

  const comment = await prisma.comment.create({
    data: { postId: post.id, userId: me, parentId, text: parsed.data.text },
    include: { user: true },
  });
  res.status(201).json({
    id: comment.id,
    text: comment.text,
    createdAt: comment.createdAt,
    parentId: comment.parentId,
    user: userBrief(comment.user),
    likeCount: 0,
    likedByMe: false,
    canDelete: true,
  });
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
  res.json({ ok: true });
}));
