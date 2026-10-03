export const MIN_AGE = 18;

/** «ГГГГ-ММ-ДД» → дата (UTC, полночь). Несуществующие даты вроде 31 февраля и даты из будущего отклоняются. */
export function parseBirthDate(value: string, now = new Date()): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 1900 || date.getTime() > now.getTime()) return null;
  return date;
}

export function isAdult(birthDate: Date, now = new Date()): boolean {
  const years = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const hadBirthday =
    now.getUTCMonth() > birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() >= birthDate.getUTCDate());
  return (hadBirthday ? years : years - 1) >= MIN_AGE;
}

export const UNDERAGE_MESSAGE = "BeerVia — приложение для совершеннолетних: пользоваться им можно только с 18 лет.";
