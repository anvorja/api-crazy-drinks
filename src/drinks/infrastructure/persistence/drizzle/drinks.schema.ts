import {
  boolean,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface IngredientRecord {
  name: string;
  measure: string | null;
}

export const drinksTable = pgTable('drinks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  alcoholic: boolean('alcoholic').notNull(),
  glass: text('glass'),
  iba: text('iba'),
  tags: text('tags').array().notNull().default([]),
  image: text('image'),
  video: text('video'),
  instructionsEn: text('instructions_en'),
  instructionsEs: text('instructions_es'),
  ingredients: jsonb('ingredients').$type<IngredientRecord[]>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const catalogSyncsTable = pgTable('catalog_syncs', {
  id: serial('id').primaryKey(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
});

export type DrinkRecord = typeof drinksTable.$inferSelect;
export type NewDrinkRecord = typeof drinksTable.$inferInsert;
