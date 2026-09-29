import "dotenv/config";
import path from "path";
import cors from "cors";
import express from "express";
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

// Express 4 doesn't forward a rejected promise from an async route handler
// to error middleware on its own, and Node kills the whole process on an
// unhandled rejection by default — so one buggy request would otherwise take
// the entire API down, register/login included. Log it and keep serving.
process.on("unhandledRejection", (reason) => {
  console.error("Необработанная ошибка в асинхронном обработчике:", reason);
});

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Реальные фото пива — те же, что собираются для датасета CLIP (см. /ml).
// beer.imageUrl хранит относительный путь вида "/beer-photos/<slug>/<файл>",
// мобильное приложение достраивает его до полного адреса само (см.
// mobile/src/api/config.ts resolveMediaUrl) — так же, как уже делает для API_URL.
app.use("/beer-photos", express.static(path.join(__dirname, "..", "..", "ml", "dataset")));

// Фото из постов. nosniff — чтобы браузер не пытался «угадать» иной тип файла.
app.use("/uploads", express.static(UPLOADS_DIR, { setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff") }));

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

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => {
  console.log(`BeerVia API listening on http://localhost:${port}`);
});
attachRealtime(server);
