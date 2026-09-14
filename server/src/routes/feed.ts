import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const feedRouter = Router();

// GET /feed — text/photo posts from all users (friends-feed v1: global feed,
// ready to be narrowed to accepted friendships once that UI lands).
feedRouter.get("/", requireAuth, async (_req, res) => {
  const posts = await prisma.friendPost.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json(
    posts.map((p) => ({
      id: p.id,
      text: p.text,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt,
      user: { id: p.user.id, name: p.user.name, avatarUrl: p.user.avatarUrl },
    }))
  );
});

const postSchema = z.object({
  text: z.string().min(1).max(500),
  imageUrl: z.string().url().optional(),
});

feedRouter.post("/", requireAuth, async (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Текст поста обязателен (до 500 символов)" });

  const post = await prisma.friendPost.create({
    data: { ...parsed.data, userId: req.userId! },
    include: { user: true },
  });

  res.status(201).json({
    id: post.id,
    text: post.text,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt,
    user: { id: post.user.id, name: post.user.name, avatarUrl: post.user.avatarUrl },
  });
});
