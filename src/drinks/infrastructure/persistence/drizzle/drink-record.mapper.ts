import { Drink } from '../../../domain/drink.js';
import { DrinkRecord, NewDrinkRecord } from './drinks.schema.js';

export const toDrinkRecord = (drink: Drink): NewDrinkRecord => ({
  id: drink.id,
  name: drink.name,
  category: drink.category,
  alcoholic: drink.alcoholic,
  glass: drink.glass,
  iba: drink.iba,
  tags: drink.tags,
  image: drink.image,
  video: drink.video,
  instructionsEn: drink.instructions.en,
  instructionsEs: drink.instructions.es,
  ingredients: drink.ingredients,
});

export const toDomainDrink = (record: DrinkRecord): Drink => ({
  id: record.id,
  name: record.name,
  category: record.category,
  alcoholic: record.alcoholic,
  glass: record.glass,
  iba: record.iba,
  tags: record.tags,
  image: record.image,
  video: record.video,
  instructions: { en: record.instructionsEn, es: record.instructionsEs },
  ingredients: record.ingredients,
});
