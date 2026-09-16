import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Очистка базы...");
  await prisma.friendPost.deleteMany();
  await prisma.friendship.deleteMany();
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
      imageUrl: "https://images.unsplash.com/photo-1618183479302-1e0aa382c36b?w=400",
    },
    {
      name: "Hazy Jane", breweryId: brewdog.id, style: "New England IPA", abv: 5.0, ibu: 30, barcode: "4780000000028",
      description: "Мутный NEIPA с соком манго и маракуйи, мягкой горечью и бархатистым телом.",
      sweetness: 45, bitterness: 50, sourness: 10, body: 55, aroma: 90,
      foodPairings: ["тако с курицей", "манго-сальса", "острый суп"],
      imageUrl: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=400",
    },
    {
      name: "Pale Ale", breweryId: sierra.id, style: "Pale Ale", abv: 5.6, ibu: 38, barcode: "4780000000035",
      description: "Хрестоматийный американский пэйл-эль на хмеле Cascade с сосновой и цитрусовой нотой.",
      sweetness: 35, bitterness: 60, sourness: 10, body: 45, aroma: 65,
      foodPairings: ["бургер с беконом", "барбекю рёбрышки", "выдержанный чеддер"],
      imageUrl: "https://images.unsplash.com/photo-1584225064785-c62a8b43d148?w=400",
    },
    {
      name: "Porter", breweryId: sierra.id, style: "Porter", abv: 5.6, ibu: 30, barcode: "4780000000042",
      description: "Тёмный портер с нотами жареного солода, кофе и лёгкого шоколада.",
      sweetness: 50, bitterness: 40, sourness: 5, body: 70, aroma: 55,
      foodPairings: ["копчёные рёбрышки", "шоколадный брауни", "карамельный десерт"],
      imageUrl: "https://images.unsplash.com/photo-1618889482923-38250401a84e?w=400",
    },
    {
      name: "Draught", breweryId: guinness.id, style: "Stout", abv: 4.2, ibu: 45, barcode: "4780000000059",
      description: "Ирландский стаут со сливочной пенкой, нотами жареного ячменя и лёгкой горечью кофе.",
      sweetness: 40, bitterness: 45, sourness: 5, body: 80, aroma: 55,
      foodPairings: ["устрицы", "стейк на гриле", "шоколадный десерт"],
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
    },
    {
      name: "Foreign Extra Stout", breweryId: guinness.id, style: "Stout", abv: 7.5, ibu: 60, barcode: "4780000000066",
      description: "Экспортная версия стаута — плотнее, крепче, с выраженной горечью тёмного шоколада.",
      sweetness: 45, bitterness: 60, sourness: 8, body: 85, aroma: 60,
      foodPairings: ["острый перец чили", "вяленое мясо", "тёмный шоколад"],
      imageUrl: "https://images.unsplash.com/photo-1584225064875-c62a8b43d148?w=400",
    },
    {
      name: "Hefeweissbier", breweryId: weihen.id, style: "Weizen", abv: 5.4, ibu: 12, barcode: "4780000000073",
      description: "Баварская пшеничная классика с ароматом банана и гвоздики, лёгкая и освежающая.",
      sweetness: 55, bitterness: 20, sourness: 15, body: 55, aroma: 75,
      foodPairings: ["белые баварские колбаски", "лёгкий салат", "мягкий сыр"],
      imageUrl: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400",
    },
    {
      name: "Kristallweizen", breweryId: weihen.id, style: "Weizen", abv: 5.4, ibu: 11, barcode: "4780000000080",
      description: "Фильтрованная пшеничная — прозрачнее и легче классического хефевайцена, с фруктовой нотой.",
      sweetness: 40, bitterness: 15, sourness: 10, body: 40, aroma: 65,
      foodPairings: ["лёгкий овощной салат", "фруктовый десерт", "лёгкая закуска"],
      imageUrl: "https://images.unsplash.com/photo-1600788907416-456578634209?w=400",
    },
    {
      name: "Duvel", breweryId: duvel.id, style: "Belgian Strong Ale", abv: 8.5, ibu: 32, barcode: "4780000000097",
      description: "Бельгийский сильный золотистый эль с обманчиво лёгким телом и мощным послевкусием.",
      sweetness: 45, bitterness: 40, sourness: 10, body: 60, aroma: 85,
      foodPairings: ["сыр бри", "паштет", "фруктовый тарт"],
      imageUrl: "https://images.unsplash.com/photo-1587582140565-7b280d59fed6?w=400",
    },
    {
      name: "Tripel Hop", breweryId: duvel.id, style: "Belgian Strong Ale", abv: 9.5, ibu: 50, barcode: "4780000000103",
      description: "Тройной хмель поверх бельгийской основы — агрессивная ароматика и высокая крепость.",
      sweetness: 35, bitterness: 55, sourness: 8, body: 55, aroma: 90,
      foodPairings: ["острые азиатские блюда", "пряный сыр", "жареные орехи"],
      imageUrl: "https://images.unsplash.com/photo-1618183479302-1e0aa382c36c?w=400",
    },
    {
      name: "Salvator", breweryId: paulaner.id, style: "Doppelbock", abv: 7.9, ibu: 24, barcode: "4780000000110",
      description: "Крепкий баварский двойной бок с карамельной сладостью и плотным телом.",
      sweetness: 65, bitterness: 30, sourness: 5, body: 85, aroma: 55,
      foodPairings: ["жареная свинина", "баварские кнедлики", "выдержанный сыр"],
      imageUrl: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef8?w=400",
    },
    {
      name: "Original Pilsner", breweryId: paulaner.id, style: "Pilsner", abv: 4.9, ibu: 28, barcode: "4780000000127",
      description: "Чёткий баварский пилснер с хрустящей горечью и лёгким хлебным телом.",
      sweetness: 25, bitterness: 45, sourness: 8, body: 35, aroma: 40,
      foodPairings: ["рыба на гриле", "лёгкие салаты", "солёные крекеры"],
      imageUrl: "https://images.unsplash.com/photo-1600788907416-456578634210?w=400",
    },
    {
      name: "Super Dry", breweryId: asahi.id, style: "Lager", abv: 5.0, ibu: 20, barcode: "4780000000134",
      description: "Сухой японский лагер — минимум сладости, максимум хруста и лёгкости.",
      sweetness: 15, bitterness: 30, sourness: 5, body: 25, aroma: 20,
      foodPairings: ["суши", "темпура", "эдамаме"],
      imageUrl: "https://images.unsplash.com/photo-1608270586620-248524c67de8?w=400",
    },
    {
      name: "Asahi Black", breweryId: asahi.id, style: "Schwarzbier", abv: 5.0, ibu: 22, barcode: "4780000000141",
      description: "Тёмный японский лагер с лёгкой обжаркой солода и мягким чистым финишем.",
      sweetness: 35, bitterness: 35, sourness: 5, body: 50, aroma: 35,
      foodPairings: ["якитори", "мясо на гриле", "терияки"],
      imageUrl: "https://images.unsplash.com/photo-1587582140565-7b280d59fed7?w=400",
    },
    {
      name: "Imperial Stout", breweryId: severny.id, style: "Imperial Stout", abv: 9.5, ibu: 50, barcode: "4780000000158",
      description: "Плотный имперский стаут с нотами ванили, тёмного шоколада и вишни.",
      sweetness: 60, bitterness: 55, sourness: 5, body: 95, aroma: 70,
      foodPairings: ["шоколадный торт", "сыр с голубой плесенью", "вяленая вишня"],
      imageUrl: "https://images.unsplash.com/photo-1618889482922-38250401a84f?w=400",
    },
    {
      name: "Медовый Эль", breweryId: severny.id, style: "Honey Ale", abv: 5.0, ibu: 15, barcode: "4780000000165",
      description: "Мягкий эль с добавлением липового мёда — сладковатый, с лёгкой пряностью.",
      sweetness: 70, bitterness: 20, sourness: 10, body: 50, aroma: 60,
      foodPairings: ["копчёности", "сырная тарелка", "яблочный штрудель"],
      imageUrl: "https://images.unsplash.com/photo-1600788907416-456578634211?w=400",
    },
    {
      name: "Балтийский Портер", breweryId: severny.id, style: "Baltic Porter", abv: 6.5, ibu: 28, barcode: "4780000000172",
      description: "Крепкий балтийский портер — солодовая насыщенность с нотами чернослива и какао.",
      sweetness: 55, bitterness: 35, sourness: 5, body: 80, aroma: 50,
      foodPairings: ["дичь", "тёмный шоколад", "чернослив в беконе"],
      imageUrl: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef9?w=400",
    },
    {
      name: "Rosé Lambic", breweryId: duvel.id, style: "Sour", abv: 5.0, ibu: 5, barcode: "4780000000189",
      description: "Кислый ламбик на малине — яркая кислинка, минимум горечи, лёгкое тело.",
      sweetness: 30, bitterness: 10, sourness: 90, body: 35, aroma: 70,
      foodPairings: ["козий сыр", "летние ягоды", "лёгкий фруктовый десерт"],
      imageUrl: "https://images.unsplash.com/photo-1584225064785-c62a8b43d149?w=400",
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
  const [demo, anna, igor, maria] = await Promise.all([
    prisma.user.create({ data: { email: "demo@beervia.app", passwordHash, name: "Демо Пользователь", bio: "Люблю хмелевые сорта и всё, что с ароматом тропических фруктов." } }),
    prisma.user.create({ data: { email: "anna@beervia.app", passwordHash, name: "Анна Крафт", avatarUrl: "https://i.pravatar.cc/150?img=47" } }),
    prisma.user.create({ data: { email: "igor@beervia.app", passwordHash, name: "Игорь Хмель", avatarUrl: "https://i.pravatar.cc/150?img=12" } }),
    prisma.user.create({ data: { email: "maria@beervia.app", passwordHash, name: "Мария Солод", avatarUrl: "https://i.pravatar.cc/150?img=32" } }),
  ]);

  const byName = (name: string) => beers.find((b) => b.name === name)!;

  console.log("Отзывы...");
  await Promise.all([
    prisma.review.create({ data: { beerId: byName("Punk IPA").id, userId: anna.id, rating: 5, text: "Обожаю эту горечь, идеально с острыми крылышками!" } }),
    prisma.review.create({ data: { beerId: byName("Punk IPA").id, userId: igor.id, rating: 4, text: "Классика, всегда беру на вечеринки." } }),
    prisma.review.create({ data: { beerId: byName("Hazy Jane").id, userId: maria.id, rating: 5, text: "Ароматика просто космос, как сок манго." } }),
    prisma.review.create({ data: { beerId: byName("Draught").id, userId: anna.id, rating: 4, text: "Идеальный баланс, пьётся легко." } }),
    prisma.review.create({ data: { beerId: byName("Draught").id, userId: igor.id, rating: 5 } }),
    prisma.review.create({ data: { beerId: byName("Hefeweissbier").id, userId: maria.id, rating: 4, text: "Отличное летнее пиво." } }),
    prisma.review.create({ data: { beerId: byName("Duvel").id, userId: anna.id, rating: 5, text: "Обманчиво лёгкое, будьте осторожны." } }),
    prisma.review.create({ data: { beerId: byName("Rosé Lambic").id, userId: maria.id, rating: 5, text: "Кислинка восхитительна с летними ягодами." } }),
    prisma.review.create({ data: { beerId: byName("Imperial Stout").id, userId: igor.id, rating: 4, text: "Тяжёлое, но очень насыщенное." } }),
    // demo user's own taste signal — leans hoppy & aromatic
    prisma.review.create({ data: { beerId: byName("Punk IPA").id, userId: demo.id, rating: 5, text: "Мой любимый стиль — яркий хмель и цитрус." } }),
    prisma.review.create({ data: { beerId: byName("Hazy Jane").id, userId: demo.id, rating: 5, text: "Топовая ароматика, беру снова и снова." } }),
    prisma.review.create({ data: { beerId: byName("Tripel Hop").id, userId: demo.id, rating: 4 } }),
    prisma.review.create({ data: { beerId: byName("Super Dry").id, userId: demo.id, rating: 2, text: "Слишком просто для моего вкуса." } }),
  ]);

  console.log("История сканирований...");
  const demoScans = ["Punk IPA", "Hazy Jane", "Pale Ale", "Tripel Hop", "Super Dry", "Draught"];
  for (const name of demoScans) {
    await prisma.scanHistory.create({ data: { userId: demo.id, beerId: byName(name).id } });
  }

  console.log("Лента друзей...");
  await Promise.all([
    prisma.friendPost.create({ data: { userId: anna.id, text: "Сегодня открыла для себя Rosé Lambic от Duvel — настоящий летний хит! 🍓", imageUrl: "https://images.unsplash.com/photo-1584225064785-c62a8b43d149?w=600" } }),
    prisma.friendPost.create({ data: { userId: igor.id, text: "Дегустация балтийских портеров в баре на набережной. Балтийский Портер от Северного ветра — топ." } }),
    prisma.friendPost.create({ data: { userId: maria.id, text: "Кто-нибудь пробовал Hazy Jane? Хочу с чем-то сравнить.", imageUrl: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=600" } }),
    prisma.friendPost.create({ data: { userId: anna.id, text: "Собрала вертикальную дегустацию стаутов Guinness — разница между Draught и Foreign Extra огромная." } }),
  ]);

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
