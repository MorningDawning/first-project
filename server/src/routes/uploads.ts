import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";

export const uploadsRouter = Router();

export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

// Тип определяем по первым байтам, а не по заголовку клиента — иначе под видом
// картинки можно залить что угодно и отдать потом с нашего адреса.
function sniffExtension(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

// POST /uploads — одно фото для поста. Возвращает относительную ссылку.
uploadsRouter.post("/", requireAuth, upload.single("photo"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Фото не получено" });
  const ext = sniffExtension(req.file.buffer);
  if (!ext) return res.status(400).json({ error: "Поддерживаются только JPG, PNG и WebP" });

  const dir = path.join(UPLOADS_DIR, req.userId!);
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  await fs.promises.writeFile(path.join(dir, name), req.file.buffer);
  res.status(201).json({ url: `/uploads/${req.userId}/${name}` });
}));
