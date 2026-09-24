import { Drink } from '../../src/drinks/domain/drink.js';

export const drink = (
  id: string,
  name: string,
  ingredients: string[],
  alcoholic = true,
): Drink => ({
  id,
  name,
  category: 'Cocktail',
  alcoholic,
  glass: 'Highball glass',
  iba: null,
  tags: [],
  image: `https://img/${id}.jpg`,
  video: null,
  instructions: { en: 'Mix.', es: 'Mezclar.' },
  ingredients: ingredients.map((name) => ({ name, measure: '1 oz' })),
});

export const DRINKS: Drink[] = [
  drink('1', 'Mojito', ['Light rum', 'Lime', 'Sugar', 'Mint', 'Soda water']),
  drink('2', 'Daiquiri', ['Light rum', 'Lime', 'Sugar']),
  drink('3', 'Cuba Libre', ['Light rum', 'Lime', 'Coca-Cola']),
  drink('4', 'Margarita', ['Tequila', 'Triple sec', 'Lime juice', 'Salt']),
  drink('5', 'Limeade', ['Lime juice', 'Sugar', 'Carbonated water'], false),
  drink('6', 'Chocolate Milk', ['Chocolate', 'Milk'], false),
];

export const [
  MOJITO,
  DAIQUIRI,
  CUBA_LIBRE,
  MARGARITA,
  LIMEADE,
  CHOCOLATE_MILK,
] = DRINKS;
