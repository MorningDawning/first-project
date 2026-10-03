/**
 * Приблизительный вкусовой профиль по стилю (оси 0–100, IBU) для пива, которое добавляют вручную
 * или находят по штрихкоду: точных оценок вкуса у нас для него нет, поэтому берём типичные для стиля.
 */
export type StyleProfile = { sweetness: number; bitterness: number; sourness: number; body: number; aroma: number; ibu: number };

export const STYLE_PROFILES: Record<string, StyleProfile> = {
  Lager: { sweetness: 30, bitterness: 25, sourness: 5, body: 35, aroma: 30, ibu: 18 },
  Pilsner: { sweetness: 25, bitterness: 45, sourness: 5, body: 35, aroma: 45, ibu: 30 },
  IPA: { sweetness: 30, bitterness: 70, sourness: 10, body: 50, aroma: 80, ibu: 55 },
  "New England IPA": { sweetness: 45, bitterness: 45, sourness: 10, body: 60, aroma: 90, ibu: 35 },
  "Pale Ale": { sweetness: 35, bitterness: 55, sourness: 10, body: 45, aroma: 65, ibu: 38 },
  Weizen: { sweetness: 45, bitterness: 15, sourness: 15, body: 55, aroma: 70, ibu: 14 },
  Stout: { sweetness: 40, bitterness: 50, sourness: 5, body: 80, aroma: 60, ibu: 40 },
  Porter: { sweetness: 45, bitterness: 40, sourness: 5, body: 70, aroma: 55, ibu: 32 },
  Sour: { sweetness: 30, bitterness: 10, sourness: 90, body: 35, aroma: 65, ibu: 8 },
  "Belgian Strong Ale": { sweetness: 45, bitterness: 40, sourness: 10, body: 65, aroma: 75, ibu: 30 },
  "Amber Ale": { sweetness: 45, bitterness: 40, sourness: 5, body: 55, aroma: 50, ibu: 28 },
  "Dark Lager": { sweetness: 40, bitterness: 30, sourness: 5, body: 55, aroma: 45, ibu: 22 },
  Другое: { sweetness: 40, bitterness: 40, sourness: 10, body: 50, aroma: 50, ibu: 25 },
};

export const STYLE_OPTIONS = Object.keys(STYLE_PROFILES);

export function profileFor(style: string): StyleProfile {
  return STYLE_PROFILES[style] ?? STYLE_PROFILES["Другое"];
}
