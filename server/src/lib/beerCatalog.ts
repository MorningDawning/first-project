import { Beer } from "@prisma/client";
import { prisma } from "./prisma";
import { fold } from "./text";
import { profileFor } from "./beerStyles";

export type NewBeer = {
  name: string;
  breweryName: string;
  country?: string | null;
  style: string;
  abv: number;
  barcode?: string | null;
  imageUrl?: string | null;
  description?: string;
};

/** Ищет пивоварню по названию без учёта регистра; нет такой — создаёт. */
async function findOrCreateBrewery(name: string, country?: string | null) {
  const target = fold(name);
  const all = await prisma.brewery.findMany({ select: { id: true, name: true } });
  const found = all.find((b) => fold(b.name) === target);
  if (found) return found.id;
  const created = await prisma.brewery.create({ data: { name, country: country || "Не указана" } });
  return created.id;
}

/**
 * Добавляет пиво в общий каталог. Если такое уже есть (тот же штрихкод или то же название у той же
 * пивоварни), возвращает существующее — дубликаты не плодим. Вкус берём типичный для стиля.
 */
export async function addBeerToCatalog(input: NewBeer): Promise<{ beer: Beer; created: boolean }> {
  if (input.barcode) {
    const byCode = await prisma.beer.findUnique({ where: { barcode: input.barcode } });
    if (byCode) return { beer: byCode, created: false };
  }

  const breweryId = await findOrCreateBrewery(input.breweryName, input.country);
  const sameBrewery = await prisma.beer.findMany({ where: { breweryId } });
  const twin = sameBrewery.find((b) => fold(b.name) === fold(input.name));
  if (twin) {
    // Тот же сорт, но теперь известен и штрихкод: запоминаем его для следующих сканирований.
    if (input.barcode && !twin.barcode) {
      return { beer: await prisma.beer.update({ where: { id: twin.id }, data: { barcode: input.barcode } }), created: false };
    }
    return { beer: twin, created: false };
  }

  const profile = profileFor(input.style);
  const { ibu, ...axes } = profile;
  const beer = await prisma.beer.create({
    data: {
      name: input.name,
      breweryId,
      style: input.style,
      abv: input.abv,
      ibu,
      barcode: input.barcode || null,
      imageUrl: input.imageUrl || null,
      description: input.description ?? `${input.style}. Добавлено пользователями BeerVia: вкус указан приблизительно, по типичному для стиля.`,
      ...axes,
      foodPairings: "[]",
    },
  });
  return { beer, created: true };
}
