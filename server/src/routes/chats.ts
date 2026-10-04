import fs from "fs";
import path from "path";
import { Router } from "express";
import { z } from "zod";
import { Beer, Brewery, ConversationMember, Message, User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import { TasteVector, computeUserTasteProfile, matchPercent, tasteVector } from "../lib/taste";
import { areFriends, isOnline, userBrief } from "../lib/social";
import { UPLOADS_DIR } from "./uploads";
import { clearTyping, forgetChatMembers, sendToUsers } from "../lib/realtime";

export const chatsRouter = Router();

const HISTORY = 100;
const MAX_GROUP_MEMBERS = 50;

const firstName = (name: string) => name.split(" ")[0];

function directKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

async function membership(chatId: string, userId: string) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: chatId, userId } },
    include: { conversation: true },
  });
}

async function memberUserIds(chatId: string): Promise<string[]> {
  const rows = await prisma.conversationMember.findMany({ where: { conversationId: chatId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

async function unreadIn(chatId: string, userId: string, lastReadAt: Date | null): Promise<number> {
  return prisma.message.count({
    where: {
      conversationId: chatId,
      kind: "user",
      deletedAt: null,
      senderId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}

/** Служебная строка в чате («Добавлены участники: …»); нейтральная по роду, без глаголов прошедшего времени. */
async function systemMessage(chatId: string, actorId: string, text: string) {
  const message = await prisma.message.create({
    data: { conversationId: chatId, senderId: actorId, kind: "system", text },
  });
  await prisma.conversation.update({ where: { id: chatId }, data: { lastMessageAt: message.createdAt } });
  return message;
}

function notifyChat(userIds: string[], chatId: string) {
  sendToUsers(userIds, { type: "chat", chatId });
}

// GET /chats — список диалогов: личные и групповые, от новых к старым.
chatsRouter.get("/", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: me },
    include: {
      conversation: {
        include: {
          members: { include: { user: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, include: { beer: true, sender: true } },
        },
      },
    },
  });

  const items = await Promise.all(
    memberships.map(async (m) => {
      const chat = m.conversation;
      const last = chat.messages[0] ?? null;
      const peer = chat.type === "direct" ? chat.members.find((x) => x.userId !== me)?.user ?? null : null;
      if (chat.type === "direct" && (!peer || !last)) return null; // пустые личные чаты в списке не показываем
      const fromMe = last?.senderId === me;
      return {
        id: chat.id,
        type: chat.type,
        title: chat.type === "group" ? chat.title ?? "Группа" : peer!.name,
        peer: peer ? { ...userBrief(peer), online: isOnline(peer) } : null,
        memberCount: chat.members.length,
        unread: await unreadIn(chat.id, me, m.lastReadAt),
        lastMessageAt: chat.lastMessageAt,
        lastMessage: last
          ? {
              id: last.id,
              kind: last.kind,
              text: last.text,
              beerName: last.beer?.name ?? null,
              hasPhoto: last.photoUrl !== null,
              hasAudio: last.audioUrl !== null,
              deleted: last.deletedAt !== null,
              senderName: chat.type === "group" && last.kind === "user" && !fromMe ? firstName(last.sender.name) : null,
              fromMe,
              createdAt: last.createdAt,
            }
          : null,
      };
    })
  );

  res.json(
    items
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
  );
}));

// GET /chats/unread-count — общее число непрочитанных (бейдж на самолётике).
chatsRouter.get("/unread-count", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const memberships = await prisma.conversationMember.findMany({ where: { userId: me } });
  const counts = await Promise.all(memberships.map((m) => unreadIn(m.conversationId, me, m.lastReadAt)));
  res.json({ count: counts.reduce((a, b) => a + b, 0) });
}));

const directSchema = z.object({ userId: z.string().min(1) });

// POST /chats/direct — открыть (или создать) личный чат с другом.
chatsRouter.post("/direct", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = directSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Не указан собеседник" });
  const other = parsed.data.userId;
  if (other === me) return res.status(400).json({ error: "Нельзя писать самому себе" });
  if (!(await prisma.user.findUnique({ where: { id: other } }))) return res.status(404).json({ error: "Собеседник не найден" });

  const key = directKey(me, other);
  const existing = await prisma.conversation.findUnique({ where: { directKey: key } });
  if (existing) return res.json({ id: existing.id });

  if (!(await areFriends(me, other))) return res.status(403).json({ error: "Писать можно только друзьям" });
  const chat = await prisma.conversation.create({
    data: {
      type: "direct",
      directKey: key,
      createdById: me,
      members: { create: [{ userId: me }, { userId: other }] },
    },
  });
  res.status(201).json({ id: chat.id });
}));

const groupSchema = z.object({
  title: z.string().trim().max(60).optional(),
  memberIds: z.array(z.string().min(1)).min(1).max(MAX_GROUP_MEMBERS - 1),
});

// POST /chats/group — новая группа из своих друзей.
chatsRouter.post("/group", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Выберите хотя бы одного друга" });
  const memberIds = [...new Set(parsed.data.memberIds)].filter((id) => id !== me);
  if (memberIds.length === 0) return res.status(400).json({ error: "Выберите хотя бы одного друга" });

  const users = await prisma.user.findMany({ where: { id: { in: memberIds } } });
  if (users.length !== memberIds.length) return res.status(404).json({ error: "Кого-то из участников не нашли" });
  for (const id of memberIds) {
    if (!(await areFriends(me, id))) return res.status(403).json({ error: "В группу можно добавить только друзей" });
  }

  const title = parsed.data.title || users.map((u) => firstName(u.name)).slice(0, 3).join(", ");
  const chat = await prisma.conversation.create({
    data: {
      type: "group",
      title,
      createdById: me,
      members: { create: [{ userId: me, role: "owner" }, ...memberIds.map((userId) => ({ userId }))] },
    },
  });
  await systemMessage(chat.id, me, `Группа «${title}» создана`);
  notifyChat(memberIds, chat.id);
  res.status(201).json({ id: chat.id });
}));

type MessageRow = Message & {
  sender: User;
  beer: (Beer & { brewery: Brewery }) | null;
  replyTo: (Message & { sender: User; beer: Beer | null }) | null;
};

const messageInclude = {
  sender: true,
  beer: { include: { brewery: true } },
  replyTo: { include: { sender: true, beer: true } },
} as const;

/** Что показать в цитате: короткий текст или пометка о вложении. */
function quoteOf(m: NonNullable<MessageRow["replyTo"]>, me: string) {
  const deleted = m.deletedAt !== null;
  return {
    id: m.id,
    senderName: m.senderId === me ? "Вы" : firstName(m.sender.name),
    fromMe: m.senderId === me,
    deleted,
    text: deleted ? null : m.text ? m.text.slice(0, 140) : null,
    kind: deleted ? "deleted" : m.audioUrl ? "voice" : m.photoUrl ? "photo" : m.beer ? "beer" : "text",
    beerName: deleted ? null : m.beer?.name ?? null,
  };
}

// GET /chats/:id — чат целиком: участники и последние сообщения. Помечает прочитанным.
chatsRouter.get("/:id", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const mine = await membership(req.params.id, me);
  if (!mine) return res.status(404).json({ error: "Чат не найден" });
  const chat = mine.conversation;

  const [members, rows] = await Promise.all([
    prisma.conversationMember.findMany({ where: { conversationId: chat.id }, include: { user: true }, orderBy: { joinedAt: "asc" } }),
    prisma.message.findMany({
      where: { conversationId: chat.id },
      include: messageInclude,
      orderBy: { createdAt: "desc" },
      take: HISTORY,
    }),
  ]);

  // Прочитано: двигаем свою отметку и сообщаем остальным, если было что читать.
  const latest = rows[0]?.createdAt;
  if (latest && (!mine.lastReadAt || mine.lastReadAt < latest)) {
    const now = new Date();
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: chat.id, userId: me } },
      data: { lastReadAt: now },
    });
    sendToUsers(
      members.filter((m) => m.userId !== me).map((m) => m.userId),
      { type: "read", chatId: chat.id, userId: me, at: now }
    );
  }

  const others = members.filter((m) => m.userId !== me);
  const peer = chat.type === "direct" ? others[0] ?? null : null;
  const [myProfile, peerProfile] = await Promise.all([
    computeUserTasteProfile(me),
    peer ? computeUserTasteProfile(peer.userId) : Promise.resolve(null),
  ]);

  const serialize = (m: MessageRow) => {
    const fromMe = m.senderId === me;
    const deleted = m.deletedAt !== null;
    let match: number | null = null;
    let matchWho: "you" | "peer" | null = null;
    if (m.beer && !deleted) {
      const profile: TasteVector | null = fromMe ? peerProfile : myProfile;
      if (profile) {
        match = matchPercent(profile, tasteVector(m.beer));
        matchWho = fromMe ? "peer" : "you";
      }
    }
    const readers = fromMe ? others.filter((o) => o.lastReadAt && o.lastReadAt >= m.createdAt) : [];
    return {
      id: m.id,
      kind: m.kind,
      text: deleted ? null : m.text,
      fromMe,
      createdAt: m.createdAt,
      sender: userBrief(m.sender),
      deleted,
      editedAt: deleted ? null : m.editedAt,
      replyTo: m.replyTo && !deleted ? quoteOf(m.replyTo, me) : null,
      audio: m.audioUrl && !deleted ? { url: m.audioUrl, durationMs: m.audioDurationMs ?? 0 } : null,
      photo: m.photoUrl && !deleted ? { url: m.photoUrl, width: m.photoWidth, height: m.photoHeight } : null,
      beer: m.beer && !deleted
        ? {
            id: m.beer.id,
            name: m.beer.name,
            style: m.beer.style,
            abv: m.beer.abv,
            imageUrl: m.beer.imageUrl,
            brewery: { id: m.beer.brewery.id, name: m.beer.brewery.name },
            match,
            matchWho,
          }
        : null,
      // личный чат: когда собеседник прочитал; группа: сколько человек из остальных
      readAt: fromMe && chat.type === "direct" ? peer?.lastReadAt && peer.lastReadAt >= m.createdAt ? peer.lastReadAt : null : null,
      readBy: fromMe && chat.type === "group" ? readers.length : 0,
    };
  };

  res.json({
    chat: {
      id: chat.id,
      type: chat.type,
      title: chat.type === "group" ? chat.title ?? "Группа" : peer?.user.name ?? "Чат",
      canSend: chat.type === "group" ? true : peer ? await areFriends(me, peer.userId) : false,
      myRole: mine.role,
      otherCount: others.length,
      peer: peer
        ? {
            ...userBrief(peer.user),
            online: isOnline(peer.user),
            match: myProfile && peerProfile ? matchPercent(myProfile, peerProfile) : null,
          }
        : null,
      members: members.map((m) => ({ ...userBrief(m.user), role: m.role, online: isOnline(m.user) })),
    },
    messages: rows.reverse().map(serialize),
  });
}));

const photoSchema = z.object({
  url: z.string(),
  width: z.number().int().min(1).max(20000).optional(),
  height: z.number().int().min(1).max(20000).optional(),
});

const sendSchema = z
  .object({
    text: z.string().trim().max(1000).optional(),
    beerId: z.string().optional(),
    photo: photoSchema.optional(),
    audio: z.object({ url: z.string(), durationMs: z.number().int().min(300).max(10 * 60_000) }).optional(),
    replyToId: z.string().optional(),
  })
  .refine((v) => (v.text && v.text.length > 0) || v.beerId || v.photo || v.audio, { message: "empty" });

// POST /chats/:id/messages — сообщение: текст, карточка пива, фото или голосовое; можно ответом на другое сообщение.
chatsRouter.post("/:id/messages", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Напишите сообщение" });
  const { text, beerId, photo, audio, replyToId } = parsed.data;

  const mine = await membership(req.params.id, me);
  if (!mine) return res.status(404).json({ error: "Чат не найден" });
  const chat = mine.conversation;

  const memberIds = await memberUserIds(chat.id);
  const others = memberIds.filter((id) => id !== me);
  if (chat.type === "direct" && !(others[0] && (await areFriends(me, others[0])))) {
    return res.status(403).json({ error: "Писать можно только друзьям" });
  }
  if (beerId && !(await prisma.beer.findUnique({ where: { id: beerId } }))) {
    return res.status(404).json({ error: "Пиво не найдено" });
  }
  // Фото принимаем только из собственных загрузок — чужие и внешние ссылки не подходят.
  if (photo && !new RegExp(`^/uploads/${me}/[a-f0-9]{24}\\.(jpg|png|webp)$`).test(photo.url)) {
    return res.status(400).json({ error: "Некорректное фото" });
  }
  if (audio && !new RegExp(`^/uploads/${me}/[a-f0-9]{24}\\.(m4a|webm|ogg|mp3|wav|caf)$`).test(audio.url)) {
    return res.status(400).json({ error: "Некорректная запись" });
  }
  if (audio && (photo || beerId)) return res.status(400).json({ error: "Голосовое отправляется отдельно" });
  if (replyToId) {
    const target = await prisma.message.findUnique({ where: { id: replyToId } });
    if (!target || target.conversationId !== chat.id || target.kind !== "user") {
      return res.status(404).json({ error: "Сообщение, на которое вы отвечаете, не найдено" });
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: chat.id,
      senderId: me,
      text: text || null,
      beerId: beerId ?? null,
      photoUrl: photo?.url ?? null,
      photoWidth: photo?.width ?? null,
      photoHeight: photo?.height ?? null,
      audioUrl: audio?.url ?? null,
      audioDurationMs: audio?.durationMs ?? null,
      replyToId: replyToId ?? null,
    },
  });
  await prisma.conversation.update({ where: { id: chat.id }, data: { lastMessageAt: message.createdAt } });
  // Отправляя, человек заведомо всё прочитал.
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: chat.id, userId: me } },
    data: { lastReadAt: message.createdAt },
  });

  clearTyping(chat.id, me);
  sendToUsers(others, { type: "message", chatId: chat.id, messageId: message.id, fromId: me });
  res.status(201).json({ id: message.id });
}));

const editSchema = z.object({ text: z.string().trim().max(1000) });

// PATCH /chats/:id/messages/:messageId — изменить текст своего сообщения.
chatsRouter.patch("/:id/messages/:messageId", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Слишком длинное сообщение" });
  const mine = await membership(req.params.id, me);
  if (!mine) return res.status(404).json({ error: "Чат не найден" });

  const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!message || message.conversationId !== mine.conversationId || message.deletedAt) {
    return res.status(404).json({ error: "Сообщение не найдено" });
  }
  if (message.senderId !== me || message.kind !== "user") return res.status(403).json({ error: "Изменить можно только своё сообщение" });
  if (message.audioUrl) return res.status(400).json({ error: "Голосовое изменить нельзя" });

  const text = parsed.data.text;
  const hasMedia = message.photoUrl !== null || message.beerId !== null;
  if (!text && !hasMedia) return res.status(400).json({ error: "Сообщение не может быть пустым" });
  if (text === (message.text ?? "")) return res.json({ ok: true }); // ничего не поменялось

  await prisma.message.update({ where: { id: message.id }, data: { text: text || null, editedAt: new Date() } });
  notifyChat(await memberUserIds(mine.conversationId), mine.conversationId);
  res.json({ ok: true });
}));

// DELETE /chats/:id/messages/:messageId — удалить у всех. Строка остаётся (на неё могут ссылаться ответы),
// но текст и вложения стираются, файлы удаляются с диска.
chatsRouter.delete("/:id/messages/:messageId", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const mine = await membership(req.params.id, me);
  if (!mine) return res.status(404).json({ error: "Чат не найден" });

  const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!message || message.conversationId !== mine.conversationId) return res.status(404).json({ error: "Сообщение не найдено" });
  if (message.senderId !== me || message.kind !== "user") return res.status(403).json({ error: "Удалить можно только своё сообщение" });
  if (message.deletedAt) return res.json({ ok: true });

  await prisma.message.update({
    where: { id: message.id },
    data: {
      deletedAt: new Date(),
      text: null,
      beerId: null,
      photoUrl: null,
      photoWidth: null,
      photoHeight: null,
      audioUrl: null,
      audioDurationMs: null,
      editedAt: null,
    },
  });
  for (const url of [message.photoUrl, message.audioUrl]) {
    if (!url) continue;
    const file = path.join(UPLOADS_DIR, path.relative("/uploads", url));
    if (file.startsWith(UPLOADS_DIR)) fs.promises.unlink(file).catch(() => {});
  }
  notifyChat(await memberUserIds(mine.conversationId), mine.conversationId);
  res.json({ ok: true });
}));

const renameSchema = z.object({ title: z.string().trim().min(1).max(60) });

// PATCH /chats/:id — переименовать группу (только владелец).
chatsRouter.patch("/:id", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Название от 1 до 60 символов" });
  const mine = await membership(req.params.id, me);
  if (!mine || mine.conversation.type !== "group") return res.status(404).json({ error: "Группа не найдена" });
  if (mine.role !== "owner") return res.status(403).json({ error: "Переименовать группу может только её создатель" });

  await prisma.conversation.update({ where: { id: mine.conversationId }, data: { title: parsed.data.title } });
  await systemMessage(mine.conversationId, me, `Группа переименована: «${parsed.data.title}»`);
  notifyChat(await memberUserIds(mine.conversationId), mine.conversationId);
  res.json({ ok: true });
}));

const addSchema = z.object({ userIds: z.array(z.string().min(1)).min(1).max(MAX_GROUP_MEMBERS) });

// POST /chats/:id/members — добавить своих друзей в группу.
chatsRouter.post("/:id/members", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Выберите, кого добавить" });
  const mine = await membership(req.params.id, me);
  if (!mine || mine.conversation.type !== "group") return res.status(404).json({ error: "Группа не найдена" });

  const current = await memberUserIds(mine.conversationId);
  const toAdd = [...new Set(parsed.data.userIds)].filter((id) => !current.includes(id));
  if (toAdd.length === 0) return res.json({ ok: true });
  if (current.length + toAdd.length > MAX_GROUP_MEMBERS) {
    return res.status(400).json({ error: `В группе не больше ${MAX_GROUP_MEMBERS} участников` });
  }
  const users = await prisma.user.findMany({ where: { id: { in: toAdd } } });
  if (users.length !== toAdd.length) return res.status(404).json({ error: "Кого-то не нашли" });
  for (const id of toAdd) {
    if (!(await areFriends(me, id))) return res.status(403).json({ error: "Добавлять можно только своих друзей" });
  }

  await prisma.conversationMember.createMany({ data: toAdd.map((userId) => ({ conversationId: mine.conversationId, userId })) });
  forgetChatMembers(mine.conversationId);
  await systemMessage(mine.conversationId, me, `Добавлены участники: ${users.map((u) => firstName(u.name)).join(", ")}`);
  notifyChat([...current, ...toAdd], mine.conversationId);
  res.status(201).json({ ok: true });
}));

// DELETE /chats/:id/members/:userId — выйти из группы (свой id) или убрать участника (владелец).
chatsRouter.delete("/:id/members/:userId", requireAuth, wrap(async (req, res) => {
  const me = req.userId!;
  const target = req.params.userId;
  const mine = await membership(req.params.id, me);
  if (!mine || mine.conversation.type !== "group") return res.status(404).json({ error: "Группа не найдена" });
  if (target !== me && mine.role !== "owner") return res.status(403).json({ error: "Убирать участников может только создатель группы" });

  const members = await prisma.conversationMember.findMany({ where: { conversationId: mine.conversationId }, include: { user: true }, orderBy: { joinedAt: "asc" } });
  const removed = members.find((m: ConversationMember & { user: User }) => m.userId === target);
  if (!removed) return res.status(404).json({ error: "Такого участника нет" });

  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId: mine.conversationId, userId: target } },
  });
  forgetChatMembers(mine.conversationId);
  const remaining = members.filter((m) => m.userId !== target);

  if (remaining.length === 0) {
    await prisma.conversation.delete({ where: { id: mine.conversationId } });
  } else {
    // Владелец ушёл: группа переходит к тому, кто состоит в ней дольше всех.
    if (removed.role === "owner") {
      await prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId: mine.conversationId, userId: remaining[0].userId } },
        data: { role: "owner" },
      });
    }
    await systemMessage(mine.conversationId, me, `${firstName(removed.user.name)} — больше не участник группы`);
  }
  notifyChat([...remaining.map((m) => m.userId), target], mine.conversationId);
  res.json({ ok: true });
}));
