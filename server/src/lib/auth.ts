import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// На боевом сервере подпись токенов нельзя оставлять «по умолчанию»: зная её, любой
// мог бы выписать себе токен от имени другого человека.
if (IS_PRODUCTION && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24)) {
  throw new Error("JWT_SECRET не задан или слишком короткий (нужно не меньше 24 символов)");
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}
