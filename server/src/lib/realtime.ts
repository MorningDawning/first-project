import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { prisma } from "./prisma";
import { verifyToken } from "./auth";

// Живые соединения: один пользователь может быть открыт с нескольких устройств.
const sockets = new Map<string, Set<WebSocket>>();

export function isConnected(userId: string): boolean {
  return (sockets.get(userId)?.size ?? 0) > 0;
}

export function sendToUsers(userIds: string[], payload: unknown) {
  const data = JSON.stringify(payload);
  for (const id of new Set(userIds)) {
    for (const ws of sockets.get(id) ?? []) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }
}

function touchLastSeen(userId: string) {
  prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});
}

// Кто состоит в чате и как зовут набирающего — кэшируем на полминуты,
// чтобы «печатает…» не превращалось в запрос к базе на каждый символ.
const memberCache = new Map<string, { ids: string[]; until: number }>();
const nameCache = new Map<string, { name: string; until: number }>();
const lastTyping = new Map<string, number>();

async function memberIds(chatId: string): Promise<string[]> {
  const hit = memberCache.get(chatId);
  if (hit && hit.until > Date.now()) return hit.ids;
  const rows = await prisma.conversationMember.findMany({ where: { conversationId: chatId }, select: { userId: true } });
  const ids = rows.map((r) => r.userId);
  memberCache.set(chatId, { ids, until: Date.now() + 30_000 });
  return ids;
}

/** Состав чата изменился (добавили, убрали, вышли) — сбрасываем кэш. */
export function forgetChatMembers(chatId: string) {
  memberCache.delete(chatId);
}

async function displayName(userId: string): Promise<string> {
  const hit = nameCache.get(userId);
  if (hit && hit.until > Date.now()) return hit.name;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const name = user?.name ?? "";
  nameCache.set(userId, { name, until: Date.now() + 300_000 });
  return name;
}

async function handleTyping(userId: string, chatId: string) {
  const key = `${chatId}:${userId}`;
  const now = Date.now();
  if (now - (lastTyping.get(key) ?? 0) < 1_000) return;
  lastTyping.set(key, now);

  const ids = await memberIds(chatId);
  if (!ids.includes(userId)) return;
  const name = await displayName(userId);
  sendToUsers(
    ids.filter((id) => id !== userId),
    { type: "typing", chatId, userId, name }
  );
}

export function clearTyping(chatId: string, userId: string) {
  lastTyping.delete(`${chatId}:${userId}`);
}

type AliveSocket = WebSocket & { isAlive?: boolean };

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: AliveSocket, req) => {
    const token = new URL(req.url ?? "", "http://localhost").searchParams.get("token") ?? "";
    const userId = verifyToken(token);
    if (!userId) {
      ws.close(4401, "unauthorized");
      return;
    }

    if (!sockets.has(userId)) sockets.set(userId, new Set());
    sockets.get(userId)!.add(ws);
    touchLastSeen(userId);

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; chatId?: unknown };
        if (msg.type === "typing" && typeof msg.chatId === "string") {
          handleTyping(userId, msg.chatId).catch(() => {});
        }
      } catch {
        // мусор от клиента игнорируем
      }
    });

    ws.on("close", () => {
      const set = sockets.get(userId);
      set?.delete(ws);
      if (set && set.size === 0) sockets.delete(userId);
      touchLastSeen(userId);
    });
    ws.on("error", () => ws.close());
  });

  // Мёртвые соединения (телефон ушёл из сети без «до свидания») убираем по пингу.
  const timer = setInterval(() => {
    for (const ws of wss.clients as Set<AliveSocket>) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  wss.on("close", () => clearInterval(timer));
}
