import { PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";

// Вымышленные люди, чтобы лента, друзья и сообщения не были пустыми в разработке.
// Повторный запуск безопасен: их прежние данные стираются и создаются заново,
// а настоящие аккаунты и их данные не трогаются.
const PEOPLE = [
  { key: "anna", email: "anna@beervia.app", name: "Анна Крафт", username: "anna_craft", city: "Москва", avatarUrl: "https://i.pravatar.cc/150?img=47" },
  { key: "igor", email: "igor@beervia.app", name: "Игорь Хмель", username: "igor_hop", city: "Санкт-Петербург", avatarUrl: "https://i.pravatar.cc/150?img=12" },
  { key: "maria", email: "maria@beervia.app", name: "Мария Солод", username: "masha_hops", city: "Москва", avatarUrl: "https://i.pravatar.cc/150?img=32" },
  { key: "dima", email: "dima@beervia.app", name: "Дима Орлов", username: "dima_orlov", city: "Москва", avatarUrl: null },
  { key: "nerd", email: "nerd@beervia.app", name: "beer_nerd", username: "beer_nerd", city: "Казань", avatarUrl: null },
  { key: "oleg", email: "oleg@beervia.app", name: "Олег Смирнов", username: "oleg_s", city: "Москва", avatarUrl: null },
  { key: "anya", email: "anya@beervia.app", name: "Аня Белова", username: "anya_b", city: "Москва", avatarUrl: null },
  { key: "lesha", email: "lesha@beervia.app", name: "Лёша Ким", username: "lesha_kim", city: "Москва", avatarUrl: null },
] as const;

type Key = (typeof PEOPLE)[number]["key"];

export const COMMUNITY_EMAILS: string[] = PEOPLE.map((p) => p.email);

const REVIEWS: Record<Key, [string, number, string?][]> = {
  anna: [["Punk IPA", 5, "Обожаю эту горечь, идеально с острыми крылышками!"], ["Draught", 4, "Идеальный баланс, пьётся легко."], ["Duvel", 5, "Обманчиво лёгкое, будьте осторожны."]],
  igor: [["Punk IPA", 4, "Классика, всегда беру на вечеринки."], ["Draught", 5], ["Imperial Stout", 4, "Тяжёлое, но очень насыщенное."]],
  maria: [["Hazy Jane", 5, "Ароматика просто космос, как сок манго."], ["Hefeweissbier", 4, "Отличное летнее пиво."], ["Rosé Lambic", 5, "Кислинка восхитительна с летними ягодами."]],
  dima: [["Punk IPA", 5], ["Hazy Jane", 4], ["Draught", 4]],
  nerd: [["Hazy Jane", 5], ["Rosé Lambic", 4], ["Punk IPA", 4]],
  oleg: [["Pale Ale", 5], ["Punk IPA", 4], ["Tripel Hop", 5]],
  anya: [["Hazy Jane", 5], ["Pale Ale", 4]],
  lesha: [["Draught", 5], ["Imperial Stout", 5], ["Porter", 4]],
};

const SCANS: Partial<Record<Key, string[]>> = {
  maria: ["Hazy Jane", "Rosé Lambic", "Punk IPA", "Duvel"],
  dima: ["Punk IPA", "Hazy Jane", "Draught"],
  nerd: ["Rosé Lambic", "Hazy Jane"],
};

export async function seedCommunity(prisma: PrismaClient, viewers: User[]) {
  const beers = await prisma.beer.findMany();
  const beerId = (name: string) => beers.find((b) => b.name === name)?.id ?? null;
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const users = {} as Record<Key, User>;
  for (const { key, ...data } of PEOPLE) {
    users[key] = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: { ...data, passwordHash },
    });
  }
  const ids = Object.values(users).map((u) => u.id);

  // Чистим прежнее содержимое этих людей, чтобы повторный запуск не плодил дубли.
  await prisma.message.deleteMany({ where: { OR: [{ senderId: { in: ids } }, { recipientId: { in: ids } }] } });
  await prisma.post.deleteMany({ where: { userId: { in: ids } } });
  await prisma.friendship.deleteMany({ where: { OR: [{ userId: { in: ids } }, { friendId: { in: ids } }] } });
  await prisma.review.deleteMany({ where: { userId: { in: ids } } });
  await prisma.scanHistory.deleteMany({ where: { userId: { in: ids } } });

  for (const [key, list] of Object.entries(REVIEWS) as [Key, [string, number, string?][]][]) {
    for (const [name, rating, text] of list) {
      const id = beerId(name);
      if (id) await prisma.review.create({ data: { beerId: id, userId: users[key].id, rating, text } });
    }
  }
  for (const [key, names] of Object.entries(SCANS) as [Key, string[]][]) {
    for (const name of names) {
      const id = beerId(name);
      if (id) await prisma.scanHistory.create({ data: { userId: users[key].id, beerId: id } });
    }
  }

  const link = (a: User, b: User, status = "accepted") =>
    prisma.friendship.create({ data: { userId: a.id, friendId: b.id, status } });
  await link(users.anna, users.igor);
  await link(users.anna, users.maria);
  await link(users.igor, users.nerd);
  await link(users.dima, users.nerd);

  const post = (
    key: Key,
    text: string,
    h: number,
    extra: { beer?: string; rating?: number; place?: string; visibility?: "friends" | "all" } = {}
  ) =>
    prisma.post.create({
      data: {
        userId: users[key].id,
        text,
        createdAt: hoursAgo(h),
        beerId: extra.beer ? beerId(extra.beer) : null,
        rating: extra.rating ?? null,
        place: extra.place ?? null,
        visibility: extra.visibility ?? "friends",
      },
    });
  const annaPost = await post("anna", "Сегодня открыла для себя Rosé Lambic от Duvel — настоящий летний хит! 🍓", 3, { beer: "Rosé Lambic", rating: 5, place: "Bar Hoppers" });
  const igorPost = await post("igor", "Дегустация балтийских портеров в баре на набережной. Балтийский Портер — топ.", 6, { beer: "Балтийский Портер", rating: 5 });
  const dimaPost = await post("dima", "Кто в субботу на фестиваль крафта на Флаконе? Собираю компанию 🍻", 20);
  const mariaPost = await post("maria", "Нашла в «Хмельнице» Hazy Jane на кране. Сочный, почти без горечи — идеально после работы. Кто пробовал из банки, есть разница?", 2, { beer: "Hazy Jane", rating: 5, place: "Хмельница", visibility: "all" });
  const nerdPost = await post("nerd", "Сравнил три ламбика подряд. Rosé самый доступный для новичков, остальные — только для фанатов кислого.", 5, { beer: "Rosé Lambic", rating: 4, visibility: "all" });
  await post("oleg", "Imperial Stout — как десерт в бокале. На вечер, не на литр.", 9, { beer: "Imperial Stout", rating: 4, visibility: "all" });

  for (const [p, keys] of [
    [annaPost, ["igor", "maria"]],
    [igorPost, ["anna"]],
    [dimaPost, ["anna", "igor"]],
    [mariaPost, ["dima", "nerd", "anna"]],
    [nerdPost, ["oleg", "dima"]],
  ] as [{ id: string }, Key[]][]) {
    for (const k of keys) await prisma.postLike.create({ data: { postId: p.id, userId: users[k].id } });
  }
  const c1 = await prisma.comment.create({ data: { postId: mariaPost.id, userId: users.dima.id, text: "Из банки чуть менее сочный, но аромат тот же. На кране лучше.", createdAt: hoursAgo(1) } });
  await prisma.comment.create({ data: { postId: mariaPost.id, userId: users.maria.id, parentId: c1.id, text: "Спасибо! Значит, в следующий раз снова в бар", createdAt: hoursAgo(0.75) } });
  await prisma.comment.create({ data: { postId: mariaPost.id, userId: users.nerd.id, text: "Попробуй ещё Punk IPA, если хочется горчинки поярче.", createdAt: hoursAgo(0.5) } });
  await prisma.comment.create({ data: { postId: annaPost.id, userId: users.igor.id, text: "Беру на пробу в выходные!", createdAt: hoursAgo(2) } });

  // Связи каждого настоящего аккаунта с сообществом: три друга, две входящие заявки, одна исходящая.
  for (const v of viewers) {
    await link(v, users.anna);
    await link(v, users.igor);
    await link(v, users.dima);
    await link(users.anya, v, "pending");
    await link(users.lesha, v, "pending");
    await link(v, users.oleg, "pending");
    await prisma.postLike.createMany({
      data: [annaPost, igorPost, dimaPost].map((p) => ({ postId: p.id, userId: v.id })),
    });
  }

  return { users, posts: { annaPost, igorPost, dimaPost, mariaPost, nerdPost } };
}
