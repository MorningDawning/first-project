/**
 * Выгружает весь каталог пива в ml/dataset/labels.json: по записи на каждое пиво (папка → название и пивоварня).
 * Так распознавание по этикетке видит и новое пиво из каталога, без ручного редактирования файла.
 * Уже существующие записи и их папки не меняются, новые дописываются.
 *
 * Запуск: npm run export-labels:local (локальная база) или DATABASE_URL=... npm run export-labels
 */
import { prisma } from "../lib/prisma";
import { readLabels, slugFor, writeLabels } from "../lib/labels";

async function main() {
  const labels = readLabels();
  const beers = await prisma.beer.findMany({ include: { brewery: true }, orderBy: { name: "asc" } });

  let added = 0;
  for (const beer of beers) {
    const { slug, isNew } = slugFor(labels, beer.name, beer.brewery.name);
    if (!isNew) continue;
    labels[slug] = { beer: beer.name, brewery: beer.brewery.name };
    added++;
  }

  writeLabels(labels);
  console.log(`Готово: в labels.json ${Object.keys(labels).length} пив (добавлено новых: ${added}).`);
  console.log("Дальше: cd ml && python fetch_off_photos.py && python build_gallery.py");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
