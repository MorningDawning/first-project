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

// Токен живёт 30 дней, а аккаунт могли удалить, и возраст у старых аккаунтов мог быть не подтверждён:
// состояние пользователя проверяем в базе, но не чаще раза в полминуты на человека.
const CHECK_TTL = 30_000;
const checked = new Map<string, { until: number; adult: boolean }>();

/** Забыть сохранённую проверку: аккаунт удалён или возраст только что подтверждён. */
export function forgetAuthCheck(userId: string) {
  checked.delete(userId);
  lastTouch.delete(userId);
}

async function userState(userId: string): Promise<{ adult: boolean } | null> {
  const hit = checked.get(userId);
  if (hit && hit.until > Date.now()) return hit;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { birthDate: true } });
  if (!user) {
    checked.delete(userId);
    return null;
  }
  const state = { until: Date.now() + CHECK_TTL, adult: user.birthDate !== null };
  checked.set(userId, state);
  return state;
}

function authenticate(allowUnconfirmedAge: boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: "Требуется авторизация" });

      const userId = verifyToken(token);
      if (!userId) return res.status(401).json({ error: "Недействительный токен" });

      const state = await userState(userId);
      if (!state) return res.status(401).json({ error: "Аккаунт не найден или удалён" });
      if (!state.adult && !allowUnconfirmedAge) {
        return res.status(403).json({ error: "Подтвердите, что вам есть 18 лет", code: "age_required" });
      }

      req.userId = userId;
      touchLastSeen(userId);
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Обычная проверка: токен верный, аккаунт существует, возраст 18+ подтверждён. */
export const requireAuth = authenticate(false);

/** Только для экранов подтверждения возраста и удаления аккаунта: пускает и без подтверждённого возраста. */
export const requireAuthAnyAge = authenticate(true);
