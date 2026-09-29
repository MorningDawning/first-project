import { BEER_TAG, COUNTRIES, styleFrom } from "./openFoodFacts";
import { fold } from "./text";

/** Поля товара из Open Food Facts, которые мы запрашиваем при импорте каталога. */
export type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  countries_tags?: string[];
  image_front_url?: string;
  nutriments?: Record<string, number | string>;
  unique_scans_n?: number;
};

export type CatalogCandidate = {
  barcode: string;
  name: string;
  brand: string;
  style: string;
  abv: number | null;
  country: string | null;
  imageUrl: string | null;
  popularity: number;
};

// Всё, что в названии описывает упаковку, а не сам сорт. \b в JavaScript не работает с русскими буквами,
// поэтому границы слов задаём через Unicode-классы.
const START = "(?<![\\p{L}\\p{N}])";
const END = "(?![\\p{L}\\p{N}])";
const VOLUME = new RegExp(`${START}\\d+(?:[.,]\\d+)?\\s*(?:литра?|мл|ml|cl|сл|л|l)${END}\\.?`, "giu");
const MULTI = new RegExp(`${START}\\d+\\s*[xх×]\\s*\\d+(?:[.,]\\d+)?\\s*(?:литра?|мл|ml|cl|сл|л|l)?${END}`, "giu");
const PERCENT = new RegExp(`${START}\\d+(?:[.,]\\d+)?\\s*%`, "gu");
const PACKAGING = new RegExp(
  `${START}(?:ж\\/б|ст\\/б|с\\/б|пэт|пластик|стекло|банка|бутылка|can|bottle|glass|pet|keg|в\\s+ассортименте)${END}`,
  "giu"
);

// Слова, которыми сорт часто называют без имени: «Zatecky Gus Pilsner» нельзя сокращать до «Pilsner».
const GENERIC_WORDS = new Set([
  "pilsner", "pils", "lager", "ipa", "ale", "stout", "porter", "weizen", "wheat", "beer", "dark", "light", "premium",
  "пиво", "светлое", "тёмное", "темное", "светлый", "тёмный", "темный", "нефильтрованное", "пшеничное", "лагер", "эль",
  "пилснер", "пильзнер", "крепкое", "классическое", "оригинальное",
]);

/** «Балтика 7 Экспортное 0,45 л ж/б» → «7 Экспортное». «Жигулёвское светлое» и «Heineken Lager» остаются целиком. */
export function cleanName(raw: string, brand: string): string {
  let name = raw.replace(VOLUME, " ").replace(MULTI, " ").replace(PERCENT, " ").replace(PACKAGING, " ");
  name = name
    .replace(/[,;()\[\]]+/g, " ")
    .replace(/(?:^|\s)\.+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–\s]+|[-–\s]+$/g, "")
    .replace(/^(?:пиво|beer|bier)\s+(?=\S)/i, "")
    .trim();
  if (brand && fold(name).startsWith(fold(brand) + " ")) {
    const rest = name.slice(brand.length).trim();
    const generic = rest.split(" ").every((w) => GENERIC_WORDS.has(fold(w)));
    if (rest.length >= 3 && !/^\d+$/.test(rest) && !generic) name = rest;
  }
  return name.slice(0, 80);
}

export function abvOf(p: OffProduct): number | null {
  const raw = Number(p.nutriments?.alcohol_100g ?? p.nutriments?.alcohol);
  return Number.isFinite(raw) && raw > 0 && raw <= 25 ? Math.round(raw * 10) / 10 : null;
}

/** Превращает товар в запись каталога или отбрасывает (не пиво, нет названия/пивоварни). */
export function toCandidate(p: OffProduct): CatalogCandidate | null {
  const tags = p.categories_tags ?? [];
  if (!p.code || !/^\d{6,14}$/.test(p.code)) return null;
  if (!p.product_name || !tags.some((t) => BEER_TAG.test(t))) return null;

  const brand = (p.brands ?? "").split(",")[0].trim().slice(0, 60);
  if (!brand) return null;
  const name = cleanName(p.product_name, brand);
  if (name.length < 2 || /^\d+$/.test(name)) return null;

  const image = p.image_front_url;
  return {
    barcode: p.code,
    name,
    brand,
    style: styleFrom(tags),
    abv: abvOf(p),
    country: (p.countries_tags ?? []).map((c) => COUNTRIES[c]).find(Boolean) ?? null,
    imageUrl: image && /^https?:\/\//.test(image) ? image : null,
    popularity: Number(p.unique_scans_n) || 0,
  };
}

/** Один сорт в разных упаковках (0,33 и 0,5 л) — одна запись: оставляем самую популярную и с фото. */
export function dedupe(candidates: CatalogCandidate[]): CatalogCandidate[] {
  const best = new Map<string, CatalogCandidate>();
  for (const c of candidates) {
    const key = `${fold(c.brand)}|${fold(c.name)}`;
    const current = best.get(key);
    const better =
      !current ||
      (c.imageUrl && !current.imageUrl) ||
      (!!c.imageUrl === !!current.imageUrl && c.popularity > current.popularity);
    if (better) best.set(key, c);
  }
  return [...best.values()].sort((a, b) => b.popularity - a.popularity);
}
