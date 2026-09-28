import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import { computeUserTasteProfile, matchPercent, tasteVector, TasteVector } from "../lib/taste";
import { areFriends, isOnline, userBrief } from "../lib/social";

export const messagesRouter = Router();

// GET /messages/conversations — список диалогов: последнее сообщение и число непрочитанных.
messagesRouter.get("/conversations", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: me }, { recipientId: me }] },
    include: { beer: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const byPeer = new Map<string, { last: (typeof messages)[number]; unread: number }>();
  for (const m of messages) {
    const peer = m.senderId === me ? m.recipientId : m.senderId;
    const entry = byPeer.get(peer) ?? { last: m, unread: 0 };
    if (m.recipientId === me && m.readAt === null) entry.unread += 1;
    byPeer.set(peer, entry);
  }

  const users = await prisma.user.findMany({ where: { id: { in: [...byPeer.keys()] } } });
  const userById = new Map(users.map((u) => [u.id, u]));
  res.json(
    [...byPeer.entries()]
      .filter(([id]) => userById.has(id))
      .map(([id, { last, unread }]) => ({
        user: userBrief(userById.get(id)!),
        online: isOnline(userById.get(id)!.lastSeenAt),
        unread,
        lastMessage: {
          id: last.id,
          text: last.text,
          beerName: last.beer?.name ?? null,
          fromMe: last.senderId === me,
          createdAt: last.createdAt,
        },
      }))
  );
}));

// GET /messages/unread-count — общее число непрочитанных (для бейджа на самолётике).
messagesRouter.get("/unread-count", requireAuth, wrap(async (req, res) => {
  res.json({ count: await prisma.message.count({ where: { recipientId: req.userId, readAt: null } }) });
}));

async function serializeThread(me: string, peerId: string) {
  const [rows, myProfile, peerProfile] = await Promise.all([
    prisma.message.findMany({
      where: { OR: [{ senderId: me, recipientId: peerId }, { senderId: peerId, recipientId: me }] },
      include: { beer: { include: { brewery: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    computeUserTasteProfile(me),
    computeUserTasteProfile(peerId),
  ]);
  const forRecipient = (recipientId: string, beer: Parameters<typeof tasteVector>[0]) => {
    const profile: TasteVector | null = recipientId === me ? myProfile : peerProfile;
    return profile ? matchPercent(profile, tasteVector(beer)) : null;
  };
  return rows.reverse().map((m) => ({
    id: m.id,
    text: m.text,
    fromMe: m.senderId === me,
    createdAt: m.createdAt,
    readAt: m.readAt,
    beer: m.beer
      ? {
          id: m.beer.id,
          name: m.beer.name,
          style: m.beer.style,
          abv: m.beer.abv,
          imageUrl: m.beer.imageUrl,
          brewery: { id: m.beer.brewery.id, name: m.beer.brewery.name },
          // процент считается для получателя — как в макете: «Диме: 86%»
          matchForRecipient: forRecipient(m.recipientId, m.beer),
        }
      : null,
  }));
}

// GET /messages/with/:userId — переписка; входящие помечаются прочитанными.
messagesRouter.get("/with/:userId", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const peer = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!peer || peer.id === me) return res.status(404).json({ error: "Собеседник не найден" });

  await prisma.message.updateMany({
    where: { senderId: peer.id, recipientId: me, readAt: null },
    data: { readAt: new Date() },
  });

  const [messages, canSend, myProfile, peerProfile] = await Promise.all([
    serializeThread(me, peer.id),
    areFriends(me, peer.id),
    computeUserTasteProfile(me),
    computeUserTasteProfile(peer.id),
  ]);
  res.json({
    peer: {
      ...userBrief(peer),
      online: isOnline(peer.lastSeenAt),
      match: myProfile && peerProfile ? matchPercent(myProfile, peerProfile) : null,
    },
    canSend,
    messages,
  });
}));

const sendSchema = z
  .object({ text: z.string().trim().max(1000).optional(), beerId: z.string().optional() })
  .refine((v) => (v.text && v.text.length > 0) || v.beerId, { message: "empty" });

// POST /messages/with/:userId — написать другу (текст и/или карточка с пивом).
messagesRouter.post("/with/:userId", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Напишите сообщение" });

  if (req.params.userId === me) return res.status(400).json({ error: "Нельзя писать самому себе" });
  if (!(await prisma.user.findUnique({ where: { id: req.params.userId } }))) {
    return res.status(404).json({ error: "Собеседник не найден" });
  }
  if (!(await areFriends(me, req.params.userId))) {
    return res.status(403).json({ error: "Писать можно только друзьям" });
  }
  if (parsed.data.beerId && !(await prisma.beer.findUnique({ where: { id: parsed.data.beerId } }))) {
    return res.status(404).json({ error: "Пиво не найдено" });
  }

  const message = await prisma.message.create({
    data: {
      senderId: me,
      recipientId: req.params.userId,
      text: parsed.data.text || null,
      beerId: parsed.data.beerId ?? null,
    },
  });
  res.status(201).json({ id: message.id });
}));
