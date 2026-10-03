import "dotenv/config";
import path from "path";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "./lib/prisma";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { beersRouter } from "./routes/beers";
import { scanRouter } from "./routes/scan";
import { barRouter } from "./routes/bar";
import { breweriesRouter } from "./routes/breweries";
import { tasteProfileRouter } from "./routes/tasteProfile";
import { feedRouter } from "./routes/feed";
import { wishlistRouter } from "./routes/wishlist";
import { friendsRouter } from "./routes/friends";
import { postsRouter, commentsRouter } from "./routes/posts";
import { profilesRouter } from "./routes/profiles";
import { chatsRouter } from "./routes/chats";
import { attachRealtime } from "./lib/realtime";
import { UPLOADS_DIR, uploadsRouter } from "./routes/uploads";
import { legalRouter } from "./routes/legal";
import { legalConfigured } from "./lib/legal";

// Express 4 doesn't forward a rejected promise from an async route handler
// to error middleware on its own, and Node kills the whole process on an
// unhandled rejection by default — so one buggy request would otherwise take
// the entire API down, register/login included. Log it and keep serving.
process.on("unhandledRejection", (reason) => {
  console.error("Необработанная ошибка в асинхронном обработчике:", reason);
});

const app = express();

// За прокси хостинга (Render и подобные) настоящий адрес клиента приходит в заголовке;
// без этого ограничение по IP считало бы всех людей одним.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Проверка для хостинга: сервер жив и база отвечает.
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Защита от подбора паролей и массовой регистрации. Только на боевом сервере,
// чтобы не мешать своим проверкам при разработке.
if (process.env.NODE_ENV === "production") {
  app.use(
    ["/auth/login", "/auth/register"],
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Слишком много попыток. Попробуйте через несколько минут." },
    })
  );
}

// Реальные фото пива — те же, что собираются для датасета CLIP (см. /ml).
// beer.imageUrl хранит относительный путь вида "/beer-photos/<slug>/<файл>",
// мобильное приложение достраивает его до полного адреса само (см.
// mobile/src/api/config.ts resolveMediaUrl) — так же, как уже делает для API_URL.
app.use("/beer-photos", express.static(path.join(__dirname, "..", "..", "ml", "dataset")));

// Фото из постов. nosniff — чтобы браузер не пытался «угадать» иной тип файла.
app.use("/uploads", express.static(UPLOADS_DIR, { setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff") }));

app.use("/", legalRouter);
app.use("/auth", authRouter);
app.use("/", usersRouter);
app.use("/beers", beersRouter);
app.use("/scan", scanRouter);
app.use("/bar", barRouter);
app.use("/breweries", breweriesRouter);
app.use("/taste-profile", tasteProfileRouter);
app.use("/feed", feedRouter);
app.use("/wishlist", wishlistRouter);
app.use("/friends", friendsRouter);
app.use("/posts", postsRouter);
app.use("/comments", commentsRouter);
app.use("/users", profilesRouter);
app.use("/chats", chatsRouter);
app.use("/uploads", uploadsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

if (process.env.NODE_ENV === "production" && !legalConfigured()) {
  console.warn("[!] Не заданы LEGAL_OPERATOR и LEGAL_CONTACT_EMAIL: в политике конфиденциальности останутся заглушки в скобках.");
}

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => {
  console.log(`BeerVia API listening on http://localhost:${port}`);
});
attachRealtime(server);
