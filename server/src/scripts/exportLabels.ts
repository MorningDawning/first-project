/**
 * Выгружает весь каталог пива в ml/dataset/labels.json: по записи на каждое пиво (папка → название и пивоварня).
 * Так распознавание по этикетке видит и новое пиво из каталога, без ручного редактирования файла.
 * Уже существующие записи и их папки не меняются, новые дописываются.
 *
 * Запуск: npm run export-labels:local (локальная база) или DATABASE_URL=... npm run export-labels
 */
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

const LABELS_PATH = path.join(__dirname, "..", "..", "..", "ml", "dataset", "labels.json");

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(text: string): string {
  const latin = [...text.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join("");
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "beer";
}

type Label = { beer: string; brewery: string };

async function main() {
  const existing: Record<string, string | Label> = fs.existsSync(LABELS_PATH)
    ? JSON.parse(fs.readFileSync(LABELS_PATH, "utf-8"))
    : {};
  const labels: Record<string, Label> = Object.fromEntries(
    Object.entries(existing).map(([slug, v]) => [slug, typeof v === "string" ? { beer: v, brewery: "" } : v])
  );

  const known = new Set(Object.values(labels).map((l) => `${l.beer}|${l.brewery}`));
  const beers = await prisma.beer.findMany({ include: { brewery: true }, orderBy: { name: "asc" } });

  let added = 0;
  for (const beer of beers) {
    if (known.has(`${beer.name}|${beer.brewery.name}`)) continue;
    let slug = slugify(beer.name);
    if (labels[slug]) slug = slugify(`${beer.brewery.name}-${beer.name}`);
    for (let i = 2; labels[slug]; i++) slug = `${slugify(`${beer.brewery.name}-${beer.name}`)}-${i}`;
    labels[slug] = { beer: beer.name, brewery: beer.brewery.name };
    known.add(`${beer.name}|${beer.brewery.name}`);
    added++;
  }

  fs.writeFileSync(LABELS_PATH, JSON.stringify(labels, null, 2) + "\n", "utf-8");
  console.log(`Готово: в labels.json ${Object.keys(labels).length} пив (добавлено новых: ${added}).`);
  console.log("Дальше: cd ml && python fetch_off_photos.py && python build_gallery.py");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
