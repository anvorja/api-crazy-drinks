import { z } from 'zod';

/** "true"/"false" query strings as booleans (z.coerce.boolean treats "false" as true). */
export const queryBoolean = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

/** Comma separated list: "a, b,,c" -> ["a", "b", "c"]. */
export const queryList = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean),
  );
