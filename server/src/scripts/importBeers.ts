/**
 * Загружает в каталог настоящее пиво из открытой базы Open Food Facts (openfoodfacts.org):
 * самое популярное (по числу сканирований) в выбранных странах и в мире, с очисткой названий,
 * без дублей (один сорт в разных упаковках — одна запись), со штрихкодами и фото упаковки.
 *
 * Запуск (локальная база):  npm run import-beers:local -- --country=russia --limit=300
 * Запуск (боевая база):      DATABASE_URL=... npm run import-beers -- --country=russia --limit=300
 *
 * Параметры:
 *   --country=russia,belarus  страны через запятую (по-английски, как в Open Food Facts); по умолчанию russia
 *   --limit=300               сколько пив брать на каждую страну (по умолчанию 300)
 *   --world=100               сколько самых популярных пив мира добавить сверху (по умолчанию 100, 0 — не добавлять)
 *   --no-images               не скачивать фото упаковок
 *   --dry-run                 только показать, что будет добавлено
 *
 * Сервис просит не больше 10 поисковых запросов в минуту, поэтому загрузка идёт неторопливо:
 * на каждые 100 пив уходит около 7 секунд ожидания. Повторный запуск безопасен: то, что уже есть, пропускается.
 */
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { addBeerToCatalog } from "../lib/beerCatalog";
import { CatalogCandidate, OffProduct, dedupe, toCandidate } from "../lib/offCatalog";
import { DATASET_DIR, readLabels, slugFor, writeLabels } from "../lib/labels";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const BASE = (args["base-url"] as string) ?? process.env.OFF_BASE_URL ?? "https://world.openfoodfacts.org";
const COUNTRIES = ((args.country as string) ?? "russia").split(",").map((c) => c.trim()).filter(Boolean);
const LIMIT = Number(args.limit ?? 300);
const WORLD = Number(args.world ?? 100);
const DELAY = Number(args.delay ?? 6500);
const WITH_IMAGES = args["no-images"] === undefined;
const DRY = args["dry-run"] !== undefined;
const HEADERS = { "User-Agent": "BeerVia/0.1 (beervia.app)" };
const FIELDS = "code,product_name,brands,categories_tags,countries_tags,image_front_url,nutriments,unique_scans_n";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(country: string | null, page: number): Promise<OffProduct[]> {
  const params = new URLSearchParams({
    action: "process", json: "1", page_size: "100", page: String(page),
    sort_by: "unique_scans_n", fields: FIELDS,
    tagtype_0: "categories", tag_contains_0: "contains", tag_0: "beers",
  });
  if (country) {
    params.set("tagtype_1", "countries");
    params.set("tag_contains_1", "contains");
    params.set("tag_1", country);
  }
  const response = await fetch(`${BASE}/cgi/search.pl?${params}`, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Open Food Facts ответил ${response.status}`);
  return ((await response.json()) as { products?: OffProduct[] }).products ?? [];
}

/** Собирает до `limit` разных сортов для страны (или для мира, если country = null). */
async function collect(country: string | null, limit: number): Promise<CatalogCandidate[]> {
  const label = country ?? "весь мир";
  const pool: CatalogCandidate[] = [];
  let unique: CatalogCandidate[] = [];
  for (let page = 1; page <= 30 && unique.length < limit; page++) {
    let products: OffProduct[];
    try {
      products = await fetchPage(country, page);
    } catch (e) {
      console.error(`  [ошибка] ${label}, страница ${page}: ${(e as Error).message}`);
      break;
    }
    if (products.length === 0) break;
    for (const p of products) {
      const c = toCandidate(p);
      if (c) pool.push(c);
    }
    unique = dedupe(pool);
    console.log(`  ${label}: страница ${page}, разных сортов пока ${unique.length}`);
    await sleep(DELAY);
  }
  return unique.slice(0, limit);
}

async function download(url: string, file: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return false;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000) return false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const wanted: CatalogCandidate[] = [];
  for (const country of COUNTRIES) wanted.push(...(await collect(country, LIMIT)));
  if (WORLD > 0) wanted.push(...(await collect(null, WORLD)));
  const beers = dedupe(wanted);
  console.log(`\nНайдено разных сортов: ${beers.length}`);

  if (DRY) {
    for (const b of beers.slice(0, 40)) console.log(`  ${b.brand} — ${b.name} (${b.style}, ${b.abv ?? "?"}%)${b.imageUrl ? "" : " [без фото]"}`);
    console.log("Это пробный запуск, в базу ничего не записано.");
    return;
  }

  const labels = readLabels();
  let created = 0;
  let photos = 0;
  for (const c of beers) {
    const { beer, created: isNew } = await addBeerToCatalog({
      name: c.name,
      breweryName: c.brand,
      country: c.country,
      style: c.style,
      abv: c.abv ?? 5,
      barcode: c.barcode,
      imageUrl: c.imageUrl,
      description: `${c.style}.${c.abv ? "" : " Крепость указана приблизительно."} Данные из Open Food Facts; вкус оценён по типичному для стиля.`,
    });
    if (isNew) created++;

    const { slug } = slugFor(labels, c.name, c.brand);
    labels[slug] = { beer: beer.name, brewery: c.brand };
    if (WITH_IMAGES && c.imageUrl) {
      const file = path.join(DATASET_DIR, slug, `off-${c.barcode}.jpg`);
      if (fs.existsSync(file) || (await download(c.imageUrl, file))) {
        photos++;
        fs.appendFileSync(
          path.join(DATASET_DIR, slug, "SOURCES.txt"),
          `off-${c.barcode}.jpg\thttps://world.openfoodfacts.org/product/${c.barcode}\tOpen Food Facts, CC BY-SA 3.0\n`
        );
        await prisma.beer.update({ where: { id: beer.id }, data: { imageUrl: `/beer-photos/${slug}/off-${c.barcode}.jpg` } });
      }
    }
  }
  writeLabels(labels);

  console.log(`\nГотово: новых пив в каталоге ${created}, всего в labels.json ${Object.keys(labels).length}, фото упаковок скачано ${photos}.`);
  console.log("Дальше: cd ml && python make_cutouts.py && python build_gallery.py, затем в server: npm run sync-photos:local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
