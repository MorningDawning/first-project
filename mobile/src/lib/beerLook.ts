/** Цвет пива и подача по стилю. Точного цвета (EBC) в данных нет, поэтому берём типичный для стиля. */

const STYLE_COLOR: Record<string, string> = {
  Lager: "#efc75e",
  Pilsner: "#f2d067",
  IPA: "#d9962f",
  "New England IPA": "#e9b44c",
  "Pale Ale": "#e0a53c",
  Weizen: "#f0c25a",
  Stout: "#2b1a12",
  Porter: "#4a2c1c",
  Sour: "#c9676b",
  "Belgian Strong Ale": "#e2a94a",
  "Amber Ale": "#c9803a",
  "Dark Lager": "#5a3420",
};
const DEFAULT_COLOR = "#d9a441";

export const beerColor = (style: string): string => STYLE_COLOR[style] ?? DEFAULT_COLOR;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Чем меньше, тем темнее пиво. */
export const lightness = (style: string): number => luminance(beerColor(style));

export const isDarkBeer = (style: string): boolean => lightness(style) < 0.35;

/** Осветлённый оттенок цвета — для пузырьков на шапке. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

type Serving = { temp: string; tempNote: string; glass: string; glassNote: string };

const SERVING: Record<string, Serving> = {
  Lager: { temp: "4–6°", tempNote: "хорошо охладить", glass: "Высокий стакан", glassNote: "сохраняет пену" },
  Pilsner: { temp: "4–6°", tempNote: "хорошо охладить", glass: "Пилснер", glassNote: "высокий и узкий" },
  IPA: { temp: "6–8°", tempNote: "охладить, не ледяным", glass: "Тюльпан", glassNote: "держит аромат хмеля" },
  "New England IPA": { temp: "6–8°", tempNote: "охладить, не ледяным", glass: "Тюльпан", glassNote: "держит аромат хмеля" },
  "Pale Ale": { temp: "7–9°", tempNote: "прохладным", glass: "Тюльпан", glassNote: "держит аромат хмеля" },
  Weizen: { temp: "6–8°", tempNote: "охладить", glass: "Вайценбокал", glassNote: "высокая шапка пены" },
  Stout: { temp: "10–12°", tempNote: "слегка прохладным", glass: "Кружка или тюльпан", glassNote: "раскрывает обжарку" },
  Porter: { temp: "10–12°", tempNote: "слегка прохладным", glass: "Кружка", glassNote: "раскрывает солод" },
  Sour: { temp: "6–9°", tempNote: "охладить", glass: "Тюльпан", glassNote: "собирает аромат" },
  "Belgian Strong Ale": { temp: "8–10°", tempNote: "не ледяным", glass: "Тюльпан или кубок", glassNote: "для крепкого пива" },
  "Amber Ale": { temp: "8–10°", tempNote: "прохладным", glass: "Кружка", glassNote: "раскрывает солод" },
  "Dark Lager": { temp: "7–9°", tempNote: "прохладным", glass: "Кружка", glassNote: "раскрывает солод" },
};
const DEFAULT_SERVING: Serving = { temp: "6–8°", tempNote: "охладить, не ледяным", glass: "Пивной бокал", glassNote: "любой чистый" };

export const servingFor = (style: string): Serving => SERVING[style] ?? DEFAULT_SERVING;
