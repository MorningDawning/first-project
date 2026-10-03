import { PrismaClient } from "@prisma/client";
import { COMMUNITY_EMAILS, seedCommunity } from "./community";

// Добавляет вымышленное сообщество (друзья, посты, комментарии) к уже существующим
// аккаунтам, не стирая ни их, ни каталог пива. Безопасно запускать повторно.
const prisma = new PrismaClient();

async function main() {
  const viewers = await prisma.user.findMany({ where: { email: { notIn: COMMUNITY_EMAILS } } });
  if (viewers.length === 0) {
    console.log("Аккаунтов пока нет — сначала зарегистрируйся в приложении.");
    return;
  }
  await seedCommunity(prisma, viewers);
  console.log(`Готово ✅ Сообщество подключено к аккаунтам: ${viewers.map((v) => v.email).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
