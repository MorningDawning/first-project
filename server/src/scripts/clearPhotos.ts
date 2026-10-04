/**
 * Убирает картинки пива из приложения, чтобы начать с чистого листа:
 *   1. у всех пив в базе очищается ссылка на картинку (в приложении будут заглушки);
 *   2. в ml/dataset/<сорт>/ удаляются вырезки cutout.png.
 * Ваши исходные фото (front.*) и фото из Open Food Facts для распознавания остаются на месте.
 *
 * С флагом --originals дополнительно удаляются скачанные фото Open Food Facts (off-*.jpg) и SOURCES.txt.
 * С флагом --front удаляются и ваши фото front.*.
 *
 * Запуск: npm run clear-photos:local [-- --originals] [-- --front]
 */
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { DATASET_DIR } from "../lib/labels";

const ORIGINALS = process.argv.includes("--originals");
const FRONT = process.argv.includes("--front");

async function main() {
  const cleared = await prisma.beer.updateMany({ where: { imageUrl: { not: null } }, data: { imageUrl: null } });

  const removed = { cutouts: 0, originals: 0, front: 0 };
  if (fs.existsSync(DATASET_DIR)) {
    for (const entry of fs.readdirSync(DATASET_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const folder = path.join(DATASET_DIR, entry.name);
      for (const file of fs.readdirSync(folder)) {
        const kind = /^cutout\./i.test(file) ? "cutouts" : ORIGINALS && (/^off-.*\.(jpe?g|png|webp)$/i.test(file) || file === "SOURCES.txt") ? "originals" : FRONT && /^front\./i.test(file) ? "front" : null;
        if (!kind) continue;
        fs.rmSync(path.join(folder, file));
        removed[kind]++;
      }
    }
  }

  console.log(`Готово: у ${cleared.count} пив убрана картинка в приложении.`);
  console.log(`Удалено файлов: вырезок ${removed.cutouts}, фото Open Food Facts ${removed.originals}, ваших фото ${removed.front}.`);
  console.log("Новые картинки: положите фото в ml/inbox и выполните python import_inbox.py --cut, затем npm run sync-photos:local.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
