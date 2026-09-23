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

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Реальные фото пива — те же, что собираются для датасета CLIP (см. /ml).
// beer.imageUrl хранит относительный путь вида "/beer-photos/<slug>/<файл>",
// мобильное приложение достраивает его до полного адреса само (см.
// mobile/src/api/config.ts resolveMediaUrl) — так же, как уже делает для API_URL.
app.use("/beer-photos", express.static(path.join(__dirname, "..", "..", "ml", "dataset")));

app.use("/auth", authRouter);
app.use("/", usersRouter);
app.use("/beers", beersRouter);
app.use("/scan", scanRouter);
app.use("/bar", barRouter);
app.use("/breweries", breweriesRouter);
app.use("/taste-profile", tasteProfileRouter);
app.use("/feed", feedRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`BeerVia API listening on http://localhost:${port}`);
});
