import { STYLE_OPTIONS } from "./beerStyles";

// Открытая база продуктов по штрихкодам (openfoodfacts.org). Работает без ключа; просят
// указывать, кто спрашивает. Если сервис недоступен или пива в нём нет, просто возвращаем null.
const BASE = process.env.OFF_BASE_URL ?? "https://world.openfoodfacts.org";

export type FoundProduct = {
  name: string;
  brand: string | null;
  style: string;
  abv: number | null;
  imageUrl: string | null;
  country: string | null;
};

export const COUNTRIES: Record<string, string> = {
  "en:russia": "Россия", "en:germany": "Германия", "en:belgium": "Бельгия", "en:czech-republic": "Чехия",
  "en:united-kingdom": "Великобритания", "en:ireland": "Ирландия", "en:united-states": "США",
  "en:netherlands": "Нидерланды", "en:poland": "Польша", "en:france": "Франция", "en:denmark": "Дания",
  "en:japan": "Япония", "en:mexico": "Мексика", "en:belarus": "Беларусь", "en:ukraine": "Украина",
};

export const BEER_TAG = /beer|lager|\bale\b|-ale|stout|porter|pilsner|ipa|weiss|wheat-beer|bock|lambic/;

export function styleFrom(tags: string[]): string {
  const has = (re: RegExp) => tags.some((t) => re.test(t));
  if (has(/new-england|neipa/)) return "New England IPA";
  if (has(/ipa/)) return "IPA";
  if (has(/pale-ale/)) return "Pale Ale";
  if (has(/stout/)) return "Stout";
  if (has(/porter/)) return "Porter";
  if (has(/pilsner|pils\b/)) return "Pilsner";
  if (has(/wheat|weiss|weizen/)) return "Weizen";
  if (has(/sour|lambic|gose/)) return "Sour";
  if (has(/dark-lager|schwarz|dunkel/)) return "Dark Lager";
  if (has(/lager/)) return "Lager";
  return STYLE_OPTIONS.includes("Другое") ? "Другое" : "Lager";
}

export async function lookupBarcode(code: string): Promise<FoundProduct | null> {
  if (!/^\d{6,14}$/.test(code)) return null;
  try {
    const fields = "product_name,brands,categories_tags,image_front_url,nutriments,countries_tags";
    const response = await fetch(`${BASE}/api/v2/product/${code}.json?fields=${fields}`, {
      headers: { "User-Agent": "BeerVia/0.1 (beervia.app)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        brands?: string;
        categories_tags?: string[];
        image_front_url?: string;
        nutriments?: Record<string, number | string>;
        countries_tags?: string[];
      };
    };
    const product = data.product;
    if (data.status !== 1 || !product?.product_name) return null;

    const tags = product.categories_tags ?? [];
    if (!tags.some((t) => BEER_TAG.test(t))) return null; // штрихкод не пива

    const rawAbv = Number(product.nutriments?.alcohol_100g ?? product.nutriments?.alcohol);
    const abv = Number.isFinite(rawAbv) && rawAbv > 0 && rawAbv <= 25 ? Math.round(rawAbv * 10) / 10 : null;
    const image = product.image_front_url;

    return {
      name: product.product_name.trim().slice(0, 80),
      brand: product.brands?.split(",")[0]?.trim().slice(0, 60) || null,
      style: styleFrom(tags),
      abv,
      imageUrl: image && /^https:\/\//.test(image) ? image : null,
      country: (product.countries_tags ?? []).map((c) => COUNTRIES[c]).find(Boolean) ?? null,
    };
  } catch {
    return null;
  }
}
