export const colors = {
  primary: "#D85A30", // основной — кнопки, знак
  accent: "#E8A33D", // тёплый акцент
  success: "#4A7856", // успех, совпадение вкуса
  background: "#FBF3E7", // фон
  text: "#2C1810", // текст, монолиния

  card: "#FFFFFF",
  border: "#E8DCC8",
  textMuted: "#8A7568",
  danger: "#C0392B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 18,
  lg: 28,
  xl: 36,
  pill: 999,
};

/**
 * Caprasimo и Figtree из макета не содержат кириллицы — русский текст в них
 * молча заменялся системным шрифтом. В самом макете для кириллицы стоят запасные
 * гарнитуры Rubik (заголовки) и Manrope (текст), их и берём напрямую;
 * Caprasimo оставлен только для латинского логотипа.
 */
export const fonts = {
  brand: "Caprasimo_400Regular",
  display: "Rubik_500Medium",
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
};

export const typography = {
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  heading: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
};

/** Match% → color: warm for low overlap, success green for a strong taste match. */
export function matchColor(percent: number): string {
  if (percent >= 75) return colors.success;
  if (percent >= 50) return colors.accent;
  return colors.primary;
}

/** Match% → a light tinted pill (bg) + matching darker text (fg), Vivino-style soft badges. */
export function matchTint(percent: number): { bg: string; fg: string } {
  if (percent >= 75) return { bg: "#E1EECC", fg: colors.success };
  if (percent >= 50) return { bg: "#FBE2D8", fg: "#8C491A" };
  return { bg: "#EEE7DB", fg: colors.textMuted };
}
