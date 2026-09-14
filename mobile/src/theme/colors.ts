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
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  title: { fontSize: 24, fontWeight: "700" as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: "400" as const, color: colors.textMuted },
};

/** Match% → color: warm for low overlap, success green for a strong taste match. */
export function matchColor(percent: number): string {
  if (percent >= 75) return colors.success;
  if (percent >= 50) return colors.accent;
  return colors.primary;
}
