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

const ENTITIES: Record<string, string> = { "&quot;": '"', "&amp;": "&", "&apos;": "'", "&#39;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
// В данных встречается и «&quot;», и «&quot» без точки с запятой.
const decodeEntities = (text: string) => text.replace(/&(?:quot|amp|apos|lt|gt|nbsp|#39);?/g, (m) => ENTITIES[m.endsWith(";") ? m : `${m};`] ?? m);

// Служебные приписки: не часть названия сорта.
const NOISE = new RegExp(`${START}(?:пастеризованн\\p{L}*|непастеризованн\\p{L}*|без\\s+консервантов|pasteuri[sz]ed)${END}`, "giu");

// Не пиво или не то, что ищем: напитки на основе пива, безалкогольное.
const NOT_WANTED = /(?:напиток|безалкогол|non[- ]?alcohol|alcohol[- ]?free|alkoholfrei|sans alcool)/iu;
const GENERIC_BRANDS = new Set(["пиво", "beer", "bier", "biere", "bière", "cerveza", "-", "нет", "без бренда"]);

/** Если категории не подсказали стиль, угадываем по словам в названии. */
export function styleFromName(name: string): string | null {
  const n = fold(name);
  const rules: [RegExp, string][] = [
    [/new england|neipa|нью-?инглэнд/, "New England IPA"],
    [/\bipa\b|ипа(?![\p{L}])|индиа пейл/u, "IPA"],
    [/pale ale|пейл эль/, "Pale Ale"],
    [/stout|стаут/, "Stout"],
    [/porter|портер/, "Porter"],
    [/weiss|weizen|wheat|hefe|пшеничн|вайс|вайцен|нефильтрованн/, "Weizen"],
    [/sour|lambic|gose|ламбик|кислое/, "Sour"],
    [/pils|пилснер|пильзнер|пилз/, "Pilsner"],
    [/dunkel|schwarz|темн|dark|черн/, "Dark Lager"],
    [/lager|лагер|светл|helles|export|экспорт|classic|классическ/, "Lager"],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? null;
}

function styleFromTagsOrName(tags: string[], name: string): string {
  const fromTags = styleFrom(tags);
  return fromTags !== "Другое" ? fromTags : styleFromName(name) ?? "Другое";
}

/** «Балтика 7 Экспортное 0,45 л ж/б» → «7 Экспортное». «Жигулёвское светлое» и «Heineken Lager» остаются целиком. */
export function cleanName(raw: string, brand: string): string {
  let name = decodeEntities(raw)
    .replace(/[«»"“”„]/g, " ")
    .replace(/№\s*/g, "")
    .replace(NOISE, " ")
    .replace(VOLUME, " ")
    .replace(MULTI, " ")
    .replace(PERCENT, " ")
    .replace(PACKAGING, " ");
  name = name
    .replace(/[,;()\[\]]+/g, " ")
    .replace(/(?:^|\s)\.+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–\s]+|[-–\s]+$/g, "")
    .replace(/^(?:пиво|beer|bier)\s+(?=\S)/i, "")
    .trim();
  // Пивоварню в названии не повторяем: «светлое Балтика классическое 3» → «классическое 3».
  const at = brand ? fold(name).indexOf(fold(brand)) : -1;
  if (at >= 0) {
    const rest = `${name.slice(0, at)} ${name.slice(at + brand.length)}`.replace(/\s+/g, " ").trim();
    const generic = rest.split(" ").every((w) => GENERIC_WORDS.has(fold(w)));
    if (rest.length >= 3 && !/^\d+$/.test(rest) && !generic) name = rest;
  }
  // Ведущее «светлое/тёмное», если дальше идёт само название: «светлое классическое 3».
  const words = name.split(" ");
  if (words.length > 2 && ["светлое", "светлый", "тёмное", "темное", "тёмный", "темный"].includes(fold(words[0]))) {
    name = words.slice(1).join(" ");
  }
  name = name.replace(/[.\-–\s]+$/g, "").trim();
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

  const brand = decodeEntities((p.brands ?? "").split(",")[0]).trim().slice(0, 60);
  if (!brand || GENERIC_BRANDS.has(fold(brand))) return null;
  if (NOT_WANTED.test(p.product_name) || NOT_WANTED.test(tags.join(" "))) return null;
  const name = cleanName(p.product_name, brand);
  if (name.length < 2 || /^\d+$/.test(name)) return null;
  const abv = abvOf(p);
  if (abv !== null && abv <= 0.5) return null; // безалкогольное

  const image = p.image_front_url;
  return {
    barcode: p.code,
    name,
    brand,
    style: styleFromTagsOrName(tags, p.product_name),
    abv,
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
