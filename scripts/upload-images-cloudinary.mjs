#!/usr/bin/env node
// One-off: copies the catalog pictures from TheCocktailDB to Cloudinary and writes the
// migration that points the catalog at them.
//   node scripts/upload-images-cloudinary.mjs drizzle/0012_images_cloudinary.sql
// Reads DB_* and CLOUDINARY_* from .env or the environment. Cloudinary fetches each picture
// by URL, so nothing is downloaded here. Safe to re-run: pictures already uploaded are kept.
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import pg from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

const output = process.argv[2];
if (!output) throw new Error('Usage: upload-images-cloudinary.mjs <migration.sql>');

const cloud = required('CLOUDINARY_CLOUD_NAME');
const apiKey = required('CLOUDINARY_API_KEY');
const apiSecret = required('CLOUDINARY_API_SECRET');
const folder = required('CLOUDINARY_FOLDER');
const CONCURRENCY = 6;
const DELIVERY = `https://res.cloudinary.com/${cloud}/image/upload`;
// Ingredient pictures are shown at 100x100 (TheCocktailDB's "-small" size).
const INGREDIENT_TRANSFORMATION = 'c_fit,w_100,h_100,f_auto,q_auto';

/** "Añejo Rum" -> "anejo-rum": stable, URL-safe public ids. */
const slug = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Signed upload that Cloudinary fetches from `sourceUrl`; keeps an existing asset. */
async function upload(sourceUrl, publicId, assetFolder) {
  const params = {
    asset_folder: assetFolder,
    overwrite: 'false',
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const toSign = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const signature = createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
  const body = new URLSearchParams({
    ...params,
    file: sourceUrl,
    api_key: apiKey,
    signature,
  });
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    { method: 'POST', body },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json;
}

async function runAll(tasks) {
  const queue = [...tasks];
  const worker = async () => {
    for (let task = queue.shift(); task; task = queue.shift()) await task();
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

const pool = new pg.Pool({
  host: required('DB_HOST'),
  port: Number(required('DB_PORT')),
  database: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
});
const { rows } = await pool.query(
  `select id, image, ingredients from drinks
   where image like 'https://www.thecocktaildb.com/%' order by id`,
);
await pool.end();

// Drinks: the original picture (700x700); the API derives the sizes with transformations.
const drinks = new Map();
// Ingredients by exact name (as stored) -> slug; the 350px source is enough for 100px.
const ingredientSlugs = new Map();
const ingredientSources = new Map();
for (const row of rows) {
  drinks.set(row.id, row.image);
  for (const { name, image } of row.ingredients) {
    const key = slug(name);
    ingredientSlugs.set(name, key);
    if (image && !ingredientSources.has(key))
      ingredientSources.set(key, image.replace(/-small\.png$/, '-medium.png'));
  }
}

let done = 0;
const total = drinks.size + ingredientSources.size;
const failed = [];
const uploadedIngredients = new Set();
const progress = () => {
  done++;
  if (done % 50 === 0 || done === total) console.log(`${done}/${total}`);
};

await runAll([
  ...[...drinks].map(([id, source]) => async () => {
    try {
      await upload(source, `${folder}/drinks/${id}`, `${folder}/drinks`);
    } catch (error) {
      failed.push(`drink ${id}: ${error.message}`);
    }
    progress();
  }),
  ...[...ingredientSources].map(([key, source]) => async () => {
    try {
      await upload(source, `${folder}/ingredients/${key}`, `${folder}/ingredients`);
      uploadedIngredients.add(key);
    } catch (error) {
      failed.push(`ingredient ${key}: ${error.message}`);
    }
    progress();
  }),
]);

const failedDrinks = failed.filter((f) => f.startsWith('drink '));
if (failedDrinks.length) {
  console.error(failed.join('\n'));
  throw new Error(`${failedDrinks.length} drink pictures failed: re-run the script`);
}

const quote = (v) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);
// Ingredients without a picture upstream end up with image = null.
const ingredientValues = [...ingredientSlugs]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, key]) => {
    const url = uploadedIngredients.has(key)
      ? `${DELIVERY}/${INGREDIENT_TRANSFORMATION}/${folder}/ingredients/${key}`
      : null;
    return `  (${quote(name)}, ${quote(url)})`;
  })
  .join(',\n');

writeFileSync(
  output,
  `-- Catalog pictures served from Cloudinary (${folder}/ in the ${cloud} account), copied from
-- TheCocktailDB by scripts/upload-images-cloudinary.mjs. Attribution to TheCocktailDB stays.
-- Only rows that differ change, so re-running it is harmless.
UPDATE "drinks"
SET "image" = '${DELIVERY}/${folder}/drinks/' || "id"
WHERE "image" LIKE 'https://www.thecocktaildb.com/%';
--> statement-breakpoint
WITH "ingredient_images" ("name", "image") AS (VALUES
${ingredientValues}
)
UPDATE "drinks" AS d
SET "ingredients" = (
  SELECT jsonb_agg(
    CASE WHEN m."name" IS NULL THEN e.item
    ELSE jsonb_set(e.item, '{image}', coalesce(to_jsonb(m."image"), 'null'::jsonb)) END
    ORDER BY e.position)
  FROM jsonb_array_elements(d."ingredients") WITH ORDINALITY AS e(item, position)
  LEFT JOIN "ingredient_images" m ON m."name" = e.item->>'name'
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(d."ingredients") AS e(item)
  JOIN "ingredient_images" m ON m."name" = e.item->>'name'
  WHERE e.item->>'image' IS DISTINCT FROM m."image"
);
`,
);

console.log(
  `Drinks: ${drinks.size}. Ingredients: ${uploadedIngredients.size} with picture, ` +
    `${ingredientSources.size - uploadedIngredients.size} without. Migration: ${output}`,
);
if (failed.length) console.log(`Not available upstream:\n${failed.join('\n')}`);
