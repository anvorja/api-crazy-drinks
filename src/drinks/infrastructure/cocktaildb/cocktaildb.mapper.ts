import { Drink } from '../../domain/drink.js';
import { CocktailDbDrinkDto } from './cocktaildb.dto.js';
import { ingredientImage } from './images.js';

const MAX_INGREDIENTS = 15;

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** `imagesBaseUrl` enables ingredient pictures (TheCocktailDB serves them by name). */
export function toDomainDrink(
  dto: CocktailDbDrinkDto,
  imagesBaseUrl?: string,
): Drink {
  const ingredients: Drink['ingredients'] = [];
  for (let i = 1; i <= MAX_INGREDIENTS; i++) {
    const name = clean(dto[`strIngredient${i}`]);
    if (name) {
      ingredients.push({
        name,
        measure: clean(dto[`strMeasure${i}`]),
        image: imagesBaseUrl ? ingredientImage(imagesBaseUrl, name) : null,
      });
    }
  }

  return {
    id: dto.idDrink ?? '',
    name: clean(dto.strDrink) ?? 'Unknown',
    category: clean(dto.strCategory),
    alcoholic: dto.strAlcoholic !== 'Non alcoholic',
    glass: clean(dto.strGlass),
    iba: clean(dto.strIBA),
    tags: (clean(dto.strTags) ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    image: clean(dto.strDrinkThumb),
    video: clean(dto.strVideo),
    instructions: {
      en: clean(dto.strInstructions),
      es: clean(dto.strInstructionsES),
    },
    ingredients,
  };
}
