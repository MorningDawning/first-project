import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedCatalog } from "./catalog";
import { seedCommunity } from "./community";

const prisma = new PrismaClient();

// Этот скрипт СТИРАЕТ всю базу. На чужой (облачной) базе он не запустится,
// если явно не передать --force — чтобы случайно не удалить настоящие данные.
function assertSafeTarget() {
  const url = process.env.DATABASE_URL ?? "";
  const local = url.startsWith("file:") || /@(localhost|127\.0\.0\.1)(:|\/|\?)/.test(url) || url.includes("host=/");
  if (!local && !process.argv.includes("--force")) {
    console.error("Отказ: DATABASE_URL указывает не на локальную базу, а seed стирает все данные.\nЕсли это точно нужно, запустите с флагом --force.");
    process.exit(1);
  }
}

async function main() {
  assertSafeTarget();
  console.log("Очистка базы...");
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.commentLike.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.post.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.scanHistory.deleteMany();
  await prisma.review.deleteMany();
  await prisma.beer.deleteMany();
  await prisma.brewery.deleteMany();
  await prisma.user.deleteMany();

  const { beers } = await seedCatalog(prisma);

  console.log("Пользователи...");
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const demo = await prisma.user.create({
    data: {
      email: "demo@beervia.app",
      passwordHash,
      name: "Демо Пользователь",
      username: "demo",
      birthDate: new Date("1990-01-01"),
      city: "Москва",
      bio: "Люблю хмелевые сорта и всё, что с ароматом тропических фруктов.",
    },
  });

  const byName = (name: string) => beers.find((b) => b.name === name)!;

  console.log("Отзывы демо-пользователя...");
  const R = (beer: string, rating: number, text?: string) =>
    prisma.review.create({ data: { beerId: byName(beer).id, userId: demo.id, rating, text } });
  // taste signal — leans hoppy & aromatic
  await Promise.all([
    R("Punk IPA", 5, "Мой любимый стиль — яркий хмель и цитрус."),
    R("Hazy Jane", 5, "Топовая ароматика, беру снова и снова."),
    R("Tripel Hop", 4),
    R("Super Dry", 2, "Слишком просто для моего вкуса."),
  ]);

  console.log("История сканирований...");
  for (const name of ["Punk IPA", "Hazy Jane", "Pale Ale", "Tripel Hop", "Super Dry", "Draught"]) {
    await prisma.scanHistory.create({ data: { userId: demo.id, beerId: byName(name).id } });
  }

  console.log("Сообщество (друзья, посты, комментарии, сообщения)...");
  await seedCommunity(prisma, [demo]);
  await prisma.post.create({
    data: {
      userId: demo.id,
      text: "Punk IPA снова не подвёл: цитрус, горчинка, всё как я люблю.",
      beerId: byName("Punk IPA").id,
      rating: 5,
      place: "Дома",
      createdAt: new Date(Date.now() - 30 * 3_600_000),
    },
  });

  console.log("Готово ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
