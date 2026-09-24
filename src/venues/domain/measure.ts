// Millilitres per unit, as bartenders use them.
const UNITS: [RegExp, number][] = [
  [/^(oz|ounces?|fl oz)\b/, 29.57],
  [/^ml\b/, 1],
  [/^cl\b/, 10],
  [/^dl\b/, 100],
  [/^(l|liters?|litres?)\b/, 1000],
  [/^(shots?|jiggers?)\b/, 44],
  [/^(tsp|teaspoons?)\b/, 4.93],
  [/^(tbsp|tblsp|tablespoons?)\b/, 14.79],
  [/^cups?\b/, 236.6],
  [/^pints?\b/, 473.2],
  [/^dash(es)?\b/, 0.92],
  [/^splash(es)?\b/, 5.9],
  [/^parts?\b/, 30],
];

/** "1 1/2", "1/2", "1.5", "2-3" (average) -> number. */
function parseQuantity(text: string): { value: number; rest: string } | null {
  const match = text.match(
    /^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+)|\/(\d+))?(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(.*)$/,
  );
  if (!match) return null;
  const [, whole, num, den, slashDen, rangeEnd, rest] = match;
  let value = Number(whole);
  if (num && den) value += Number(num) / Number(den);
  if (slashDen) value = Number(whole) / Number(slashDen);
  if (rangeEnd) value = (value + Number(rangeEnd)) / 2;
  return { value, rest: rest.trim() };
}

/**
 * Converts a recipe measure to millilitres. Returns null when it isn't a volume
 * ("Juice of 1/2", "1 wedge", "Garnish", "to taste").
 */
export function measureToMl(measure: string | null): number | null {
  if (!measure) return null;
  const quantity = parseQuantity(measure.trim().toLowerCase());
  if (!quantity) return null;
  const unit = UNITS.find(([pattern]) => pattern.test(quantity.rest));
  return unit ? Math.round(quantity.value * unit[1] * 100) / 100 : null;
}
