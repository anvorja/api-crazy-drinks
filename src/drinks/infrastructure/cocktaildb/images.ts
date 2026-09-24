/** TheCocktailDB serves each drink picture in several sizes by appending a suffix. */
export const drinkImageSizes = (image: string | null) =>
  image
    ? {
        small: `${image}/small`,
        medium: `${image}/medium`,
        large: `${image}/large`,
      }
    : null;

export const ingredientImage = (imagesBaseUrl: string, name: string) =>
  `${imagesBaseUrl}/ingredients/${encodeURIComponent(name)}-small.png`;
