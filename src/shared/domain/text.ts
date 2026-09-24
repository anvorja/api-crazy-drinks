/** Lowercase, trimmed and without accents: "Limón " -> "limon". */
export const normalizeText = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
