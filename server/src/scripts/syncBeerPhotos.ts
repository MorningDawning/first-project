/**
 * Подтягивает фото пива из ml/dataset/ в beer.imageUrl.
 *
 * Для каждой марки берётся «студийная» вырезка cutout.png (её делает ml/make_cutouts.py), а если вырезки нет,
 * своё фото front.* (его кладёт ml/import_inbox.py). Фото из Open Food Facts (off-*.jpg) в приложении не показываются:
 * они нужны только для распознавания. Записывается путь вида "/beer-photos/<папка>/<файл>": сервер отдаёт ml/dataset статикой
 * (см. src/index.ts), а приложение само достраивает адрес до полного (см. resolveMediaUrl в mobile/src/api/config.ts).
 *
 * Запуск: npm run sync-photos:local (можно повторять сколько угодно раз, ничего не ломает).
 */
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { DATASET_DIR, readLabels } from "../lib/labels";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

async function main() {
  const labels = readLabels();
  if (Object.keys(labels).length === 0) {
    console.error("Не найден ml/dataset/labels.json (или он пуст). Сначала: npm run export-labels:local");
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let cutouts = 0;

  for (const [slug, label] of Object.entries(labels)) {
    const folder = path.join(DATASET_DIR, slug);
    if (!fs.existsSync(folder)) {
      skipped++;
      continue;
    }
    const files = fs
      .readdirSync(folder)
      .filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .sort();
    const file = files.includes("cutout.png") ? "cutout.png" : files.find((f) => /^front\./i.test(f));
    if (!file) {
      skipped++;
      continue;
    }

    const imageUrl = `/beer-photos/${slug}/${file}`;
    const result = await prisma.beer.updateMany({
      where: { name: label.beer, ...(label.brewery ? { brewery: { name: label.brewery } } : {}) },
      data: { imageUrl },
    });
    if (result.count === 0) {
      console.log(`  [предупреждение] ${slug}: пива «${label.beer}» нет в базе`);
      continue;
    }
    if (file === "cutout.png") cutouts++;
    updated++;
  }

  console.log(`Готово: обновлено ${updated} (из них с вырезкой ${cutouts}), пропущено (нет фото) ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
