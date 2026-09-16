import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
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
  next();
}
