/** Raw drink as TheCocktailDB returns it: flat, with strIngredient1..15 / strMeasure1..15. */
export type CocktailDbDrinkDto = Record<string, string | null>;

export interface CocktailDbResponseDto {
  /** Upstream answers `null` or the string "no data found" when nothing matches. */
  drinks: CocktailDbDrinkDto[] | string | null;
}
