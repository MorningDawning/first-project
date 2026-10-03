export const MIN_AGE = 18;

/** Пока человек печатает цифры, расставляем точки: 12041995 → 12.04.1995. */
export function maskBirthDate(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

/** «ДД.ММ.ГГГГ» → «ГГГГ-ММ-ДД»; null, если даты не существует или она из будущего. */
export function birthDateToIso(masked: string, now = new Date()): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(masked);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 1900 || date.getTime() > now.getTime()) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function isAdultIso(iso: string, now = new Date()): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  const years = now.getUTCFullYear() - year;
  const hadBirthday = now.getUTCMonth() + 1 > month || (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
  return (hadBirthday ? years : years - 1) >= MIN_AGE;
}

export const UNDERAGE_TEXT = "BeerVia — приложение для совершеннолетних: пользоваться им можно только с 18 лет.";

/** Проверка формы возраста и согласия: либо дата для отправки на сервер, либо текст ошибки. */
export function checkAgeConsent(masked: string, accepted: boolean): { iso: string } | { error: string } {
  const iso = birthDateToIso(masked);
  if (!iso) return { error: "Введите дату рождения полностью: ДД.ММ.ГГГГ" };
  if (!isAdultIso(iso)) return { error: UNDERAGE_TEXT };
  if (!accepted) return { error: "Нужно подтвердить возраст и согласие с политикой конфиденциальности" };
  return { iso };
}
