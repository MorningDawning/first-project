import fs from "fs";
import path from "path";

/** ml/dataset/labels.json: какие пива знает распознавание и в каких папках лежат их фото. */
export const DATASET_DIR = path.join(__dirname, "..", "..", "..", "ml", "dataset");
export const LABELS_PATH = path.join(DATASET_DIR, "labels.json");

export type Label = { beer: string; brewery: string };
export type Labels = Record<string, Label>;

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(text: string): string {
  const latin = [...text.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join("");
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "beer";
}

export function readLabels(): Labels {
  if (!fs.existsSync(LABELS_PATH)) return {};
  const raw: Record<string, string | Label> = JSON.parse(fs.readFileSync(LABELS_PATH, "utf-8"));
  return Object.fromEntries(Object.entries(raw).map(([slug, v]) => [slug, typeof v === "string" ? { beer: v, brewery: "" } : v]));
}

export function writeLabels(labels: Labels) {
  fs.mkdirSync(DATASET_DIR, { recursive: true });
  fs.writeFileSync(LABELS_PATH, JSON.stringify(labels, null, 2) + "\n", "utf-8");
}

/** Папка для этого пива: уже известная (по названию и пивоварне) или новая с уникальным именем. */
export function slugFor(labels: Labels, beer: string, brewery: string): { slug: string; isNew: boolean } {
  for (const [slug, l] of Object.entries(labels)) if (l.beer === beer && l.brewery === brewery) return { slug, isNew: false };
  let slug = slugify(beer);
  if (labels[slug]) slug = slugify(`${brewery}-${beer}`);
  for (let i = 2; labels[slug]; i++) slug = `${slugify(`${brewery}-${beer}`)}-${i}`;
  return { slug, isNew: true };
}
