/**
 * Подтягивает реальные фото пива из ml/dataset/ (те же, что собираются для
 * дообучения CLIP) в beer.imageUrl — вместо угаданных внешних ссылок.
 *
 * Для каждой марки с хотя бы одним фото берёт первое (по алфавиту) и
 * записывает относительный путь вида "/beer-photos/<slug>/<файл>" —
 * express уже отдаёт эту папку статикой (см. src/index.ts), а мобильное
 * приложение само достраивает адрес до полного (см. resolveMediaUrl в
 * mobile/src/api/config.ts).
 *
 * Запуск: npm run sync-photos (можно повторять сколько угодно раз по мере
 * пополнения датасета — ничего не ломает и не перетирает остальные данные).
 */
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

const DATASET_DIR = path.join(__dirname, "..", "..", "..", "ml", "dataset");
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

async function main() {
  const labelsPath = path.join(DATASET_DIR, "labels.json");
  if (!fs.existsSync(labelsPath)) {
    console.error(`Не найден ${labelsPath}`);
    process.exit(1);
  }
  const labels: Record<string, string> = JSON.parse(fs.readFileSync(labelsPath, "utf-8"));

  let updated = 0;
  let skipped = 0;

  for (const [slug, beerName] of Object.entries(labels)) {
    const folder = path.join(DATASET_DIR, slug);
    if (!fs.existsSync(folder)) {
      skipped++;
      continue;
    }

    const photos = fs
      .readdirSync(folder)
      .filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .sort();

    if (photos.length === 0) {
      console.log(`  [пропуск] ${slug}: фото нет`);
      skipped++;
      continue;
    }

    const imageUrl = `/beer-photos/${slug}/${photos[0]}`;
    const result = await prisma.beer.updateMany({ where: { name: beerName }, data: { imageUrl } });

    if (result.count === 0) {
      console.log(`  [предупреждение] ${slug}: пиво "${beerName}" не найдено в базе`);
      continue;
    }

    console.log(`  ${slug} (${beerName}) -> ${imageUrl} (всего фото: ${photos.length})`);
    updated++;
  }

  console.log(`\nГотово: обновлено ${updated}, пропущено (нет фото) ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
