import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedCommunity } from "./community";

const prisma = new PrismaClient();

async function main() {
  console.log("Очистка базы...");
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
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

  console.log("Пивоварни...");
  const breweries = await Promise.all(
    [
      { name: "Северный ветер", country: "Россия", city: "Санкт-Петербург", description: "Крафтовая пивоварня с фокусом на насыщенные тёмные сорта." },
      { name: "BrewDog", country: "Шотландия", city: "Эллон", description: "Панк-пивоварня, известная хмелевыми и экспериментальными сортами." },
      { name: "Sierra Nevada", country: "США", city: "Чико", description: "Одна из пионеров крафтового пивоварения в Калифорнии." },
      { name: "Weihenstephaner", country: "Германия", city: "Фрайзинг", description: "Старейшая пивоварня мира, эталон баварских пшеничных сортов." },
      { name: "Guinness", country: "Ирландия", city: "Дублин", description: "Легендарная пивоварня стаутов с более чем 250-летней историей." },
      { name: "Duvel Moortgat", country: "Бельгия", city: "Бренданк", description: "Мастера бельгийского сильного эля." },
      { name: "Paulaner", country: "Германия", city: "Мюнхен", description: "Мюнхенская пивоварня, известная лагерами и бокбирами." },
      { name: "Asahi", country: "Япония", city: "Токио", description: "Крупнейшая японская пивоварня, законодатель стиля драй-лагер." },
    ].map((b) => prisma.brewery.create({ data: b }))
  );
  const [severny, brewdog, sierra, weihen, guinness, duvel, paulaner, asahi] = breweries;

  console.log("Пиво...");
  const beerDefs = [
    {
      name: "Punk IPA", breweryId: brewdog.id, style: "IPA", abv: 5.6, ibu: 35, barcode: "4780000000011",
      description: "Классический флагман BrewDog — яркий цитрусовый и тропический хмель на плотной хмелевой основе.",
      sweetness: 30, bitterness: 70, sourness: 10, body: 50, aroma: 80,
      foodPairings: ["острые куриные крылышки", "начос с сыром", "тайский карри"],
    },
    {
      name: "Hazy Jane", breweryId: brewdog.id, style: "New England IPA", abv: 5.0, ibu: 30, barcode: "4780000000028",
      description: "Мутный NEIPA с соком манго и маракуйи, мягкой горечью и бархатистым телом.",
      sweetness: 45, bitterness: 50, sourness: 10, body: 55, aroma: 90,
      foodPairings: ["тако с курицей", "манго-сальса", "острый суп"],
    },
    {
      name: "Pale Ale", breweryId: sierra.id, style: "Pale Ale", abv: 5.6, ibu: 38, barcode: "4780000000035",
      description: "Хрестоматийный американский пэйл-эль на хмеле Cascade с сосновой и цитрусовой нотой.",
      sweetness: 35, bitterness: 60, sourness: 10, body: 45, aroma: 65,
      foodPairings: ["бургер с беконом", "барбекю рёбрышки", "выдержанный чеддер"],
    },
    {
      name: "Porter", breweryId: sierra.id, style: "Porter", abv: 5.6, ibu: 30, barcode: "4780000000042",
      description: "Тёмный портер с нотами жареного солода, кофе и лёгкого шоколада.",
      sweetness: 50, bitterness: 40, sourness: 5, body: 70, aroma: 55,
      foodPairings: ["копчёные рёбрышки", "шоколадный брауни", "карамельный десерт"],
    },
    {
      name: "Draught", breweryId: guinness.id, style: "Stout", abv: 4.2, ibu: 45, barcode: "4780000000059",
      description: "Ирландский стаут со сливочной пенкой, нотами жареного ячменя и лёгкой горечью кофе.",
      sweetness: 40, bitterness: 45, sourness: 5, body: 80, aroma: 55,
      foodPairings: ["устрицы", "стейк на гриле", "шоколадный десерт"],
    },
    {
      name: "Foreign Extra Stout", breweryId: guinness.id, style: "Stout", abv: 7.5, ibu: 60, barcode: "4780000000066",
      description: "Экспортная версия стаута — плотнее, крепче, с выраженной горечью тёмного шоколада.",
      sweetness: 45, bitterness: 60, sourness: 8, body: 85, aroma: 60,
      foodPairings: ["острый перец чили", "вяленое мясо", "тёмный шоколад"],
    },
    {
      name: "Hefeweissbier", breweryId: weihen.id, style: "Weizen", abv: 5.4, ibu: 12, barcode: "4780000000073",
      description: "Баварская пшеничная классика с ароматом банана и гвоздики, лёгкая и освежающая.",
      sweetness: 55, bitterness: 20, sourness: 15, body: 55, aroma: 75,
      foodPairings: ["белые баварские колбаски", "лёгкий салат", "мягкий сыр"],
    },
    {
      name: "Kristallweizen", breweryId: weihen.id, style: "Weizen", abv: 5.4, ibu: 11, barcode: "4780000000080",
      description: "Фильтрованная пшеничная — прозрачнее и легче классического хефевайцена, с фруктовой нотой.",
      sweetness: 40, bitterness: 15, sourness: 10, body: 40, aroma: 65,
      foodPairings: ["лёгкий овощной салат", "фруктовый десерт", "лёгкая закуска"],
    },
    {
      name: "Duvel", breweryId: duvel.id, style: "Belgian Strong Ale", abv: 8.5, ibu: 32, barcode: "4780000000097",
      description: "Бельгийский сильный золотистый эль с обманчиво лёгким телом и мощным послевкусием.",
      sweetness: 45, bitterness: 40, sourness: 10, body: 60, aroma: 85,
      foodPairings: ["сыр бри", "паштет", "фруктовый тарт"],
    },
    {
      name: "Tripel Hop", breweryId: duvel.id, style: "Belgian Strong Ale", abv: 9.5, ibu: 50, barcode: "4780000000103",
      description: "Тройной хмель поверх бельгийской основы — агрессивная ароматика и высокая крепость.",
      sweetness: 35, bitterness: 55, sourness: 8, body: 55, aroma: 90,
      foodPairings: ["острые азиатские блюда", "пряный сыр", "жареные орехи"],
    },
    {
      name: "Salvator", breweryId: paulaner.id, style: "Doppelbock", abv: 7.9, ibu: 24, barcode: "4780000000110",
      description: "Крепкий баварский двойной бок с карамельной сладостью и плотным телом.",
      sweetness: 65, bitterness: 30, sourness: 5, body: 85, aroma: 55,
      foodPairings: ["жареная свинина", "баварские кнедлики", "выдержанный сыр"],
    },
    {
      name: "Original Pilsner", breweryId: paulaner.id, style: "Pilsner", abv: 4.9, ibu: 28, barcode: "4780000000127",
      description: "Чёткий баварский пилснер с хрустящей горечью и лёгким хлебным телом.",
      sweetness: 25, bitterness: 45, sourness: 8, body: 35, aroma: 40,
      foodPairings: ["рыба на гриле", "лёгкие салаты", "солёные крекеры"],
    },
    {
      name: "Super Dry", breweryId: asahi.id, style: "Lager", abv: 5.0, ibu: 20, barcode: "4780000000134",
      description: "Сухой японский лагер — минимум сладости, максимум хруста и лёгкости.",
      sweetness: 15, bitterness: 30, sourness: 5, body: 25, aroma: 20,
      foodPairings: ["суши", "темпура", "эдамаме"],
    },
    {
      name: "Asahi Black", breweryId: asahi.id, style: "Schwarzbier", abv: 5.0, ibu: 22, barcode: "4780000000141",
      description: "Тёмный японский лагер с лёгкой обжаркой солода и мягким чистым финишем.",
      sweetness: 35, bitterness: 35, sourness: 5, body: 50, aroma: 35,
      foodPairings: ["якитори", "мясо на гриле", "терияки"],
    },
    {
      name: "Imperial Stout", breweryId: severny.id, style: "Imperial Stout", abv: 9.5, ibu: 50, barcode: "4780000000158",
      description: "Плотный имперский стаут с нотами ванили, тёмного шоколада и вишни.",
      sweetness: 60, bitterness: 55, sourness: 5, body: 95, aroma: 70,
      foodPairings: ["шоколадный торт", "сыр с голубой плесенью", "вяленая вишня"],
    },
    {
      name: "Медовый Эль", breweryId: severny.id, style: "Honey Ale", abv: 5.0, ibu: 15, barcode: "4780000000165",
      description: "Мягкий эль с добавлением липового мёда — сладковатый, с лёгкой пряностью.",
      sweetness: 70, bitterness: 20, sourness: 10, body: 50, aroma: 60,
      foodPairings: ["копчёности", "сырная тарелка", "яблочный штрудель"],
    },
    {
      name: "Балтийский Портер", breweryId: severny.id, style: "Baltic Porter", abv: 6.5, ibu: 28, barcode: "4780000000172",
      description: "Крепкий балтийский портер — солодовая насыщенность с нотами чернослива и какао.",
      sweetness: 55, bitterness: 35, sourness: 5, body: 80, aroma: 50,
      foodPairings: ["дичь", "тёмный шоколад", "чернослив в беконе"],
    },
    {
      name: "Rosé Lambic", breweryId: duvel.id, style: "Sour", abv: 5.0, ibu: 5, barcode: "4780000000189",
      description: "Кислый ламбик на малине — яркая кислинка, минимум горечи, лёгкое тело.",
      sweetness: 30, bitterness: 10, sourness: 90, body: 35, aroma: 70,
      foodPairings: ["козий сыр", "летние ягоды", "лёгкий фруктовый десерт"],
    },
  ];

  const beers = await Promise.all(
    beerDefs.map((b) => prisma.beer.create({ data: { ...b, foodPairings: JSON.stringify(b.foodPairings) } }))
  );

  console.log("Фото пивоварен (для шапки карточки пива)...");
  const byBeerName = (name: string) => beers.find((b) => b.name === name)!;
  await Promise.all([
    prisma.brewery.update({ where: { id: severny.id }, data: { logoUrl: byBeerName("Медовый Эль").imageUrl } }),
    prisma.brewery.update({ where: { id: brewdog.id }, data: { logoUrl: byBeerName("Punk IPA").imageUrl } }),
    prisma.brewery.update({ where: { id: sierra.id }, data: { logoUrl: byBeerName("Pale Ale").imageUrl } }),
    prisma.brewery.update({ where: { id: weihen.id }, data: { logoUrl: byBeerName("Hefeweissbier").imageUrl } }),
    prisma.brewery.update({ where: { id: guinness.id }, data: { logoUrl: byBeerName("Draught").imageUrl } }),
    prisma.brewery.update({ where: { id: duvel.id }, data: { logoUrl: byBeerName("Duvel").imageUrl } }),
    prisma.brewery.update({ where: { id: paulaner.id }, data: { logoUrl: byBeerName("Salvator").imageUrl } }),
    prisma.brewery.update({ where: { id: asahi.id }, data: { logoUrl: byBeerName("Super Dry").imageUrl } }),
  ]);

  console.log("Пользователи...");
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const demo = await prisma.user.create({
    data: {
      email: "demo@beervia.app",
      passwordHash,
      name: "Демо Пользователь",
      username: "demo",
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
