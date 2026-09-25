/** TheCocktailDB serves ingredient pictures by name. */
export const ingredientImage = (imagesBaseUrl: string, name: string) =>
  `${imagesBaseUrl}/ingredients/${encodeURIComponent(name)}-small.png`;
