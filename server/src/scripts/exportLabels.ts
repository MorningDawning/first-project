/**
 * Выгружает весь каталог пива в ml/dataset/labels.json: по записи на каждое пиво (папка → название и пивоварня).
 * Так распознавание по этикетке видит и новое пиво из каталога, без ручного редактирования файла.
 * Уже существующие записи и их папки не меняются, новые дописываются.
 *
 * С флагом --prune из labels.json убираются записи, которых больше нет в каталоге (например, придуманные сорта
 * от старой тестовой базы). Папки с фото на диске остаются нетронутыми, но в распознавании не участвуют.
 *
 * Запуск: npm run export-labels:local [-- --prune] (локальная база) или DATABASE_URL=... npm run export-labels
 */
import { prisma } from "../lib/prisma";
import { Labels, readLabels, slugFor, writeLabels } from "../lib/labels";

const PRUNE = process.argv.includes("--prune");

async function main() {
  const old = readLabels();
  const labels: Labels = PRUNE ? {} : { ...old };
  const beers = await prisma.beer.findMany({ include: { brewery: true }, orderBy: { name: "asc" } });

  let added = 0;
  for (const beer of beers) {
    // Папка уже была у этого пива: оставляем её же, чтобы не потерять скачанные фото.
    const known = Object.entries(old).find(([, l]) => l.beer === beer.name && l.brewery === beer.brewery.name);
    const { slug, isNew } = known ? { slug: known[0], isNew: false } : slugFor({ ...old, ...labels }, beer.name, beer.brewery.name);
    if (labels[slug]) continue;
    labels[slug] = { beer: beer.name, brewery: beer.brewery.name };
    if (isNew) added++;
  }

  const removed = PRUNE ? Object.keys(old).filter((slug) => !labels[slug]).length : 0;
  writeLabels(labels);
  console.log(`Готово: в labels.json ${Object.keys(labels).length} пив (новых: ${added}${PRUNE ? `, убрано лишних: ${removed}` : ""}).`);
  console.log("Дальше: cd ml && python make_cutouts.py && python build_gallery.py");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
