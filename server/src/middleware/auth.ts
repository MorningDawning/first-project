import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth";
import { prisma } from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// «В сети» считается по последней активности: пишем отметку не чаще раза в минуту на пользователя.
const lastTouch = new Map<string, number>();
function touchLastSeen(userId: string) {
  const now = Date.now();
  if (now - (lastTouch.get(userId) ?? 0) < 60_000) return;
  lastTouch.set(userId, now);
  prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Недействительный токен" });
  }

  req.userId = userId;
  touchLastSeen(userId);
  next();
}
