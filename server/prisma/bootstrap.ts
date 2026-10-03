import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "./catalog";

// Запускается при каждом старте боевого сервера. Ничего не стирает:
// если каталог пива уже есть, тихо выходит; иначе загружает пивоварни и сорта.
const prisma = new PrismaClient();

async function main() {
  if ((await prisma.beer.count()) > 0) {
    console.log("Каталог пива уже загружен — пропускаем.");
    return;
  }
  await seedCatalog(prisma);
  console.log("Каталог пива загружен ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
