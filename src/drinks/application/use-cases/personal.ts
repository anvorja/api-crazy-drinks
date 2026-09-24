import { Clock } from '../../../shared/application/ports.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import {
  Recommendation,
  TasteProfile,
  buildTasteProfile,
  recommendForTaste,
} from '../../domain/taste.js';
import { Drink, DrinkVisibility, isVisible } from '../../domain/drink.js';
import {
  FavoriteRepository,
  UserPantry,
  UserPantryRepository,
  cleanPantryIngredients,
} from '../../domain/personal.js';
import { DrinkCatalog } from '../drink-catalog.js';
import { GetDrink } from './drink-queries.js';
import { PantryQuery, PantrySuggestion, SuggestFromPantry } from './lab.js';

export class GetMyPantry {
  constructor(private readonly pantries: UserPantryRepository) {}

  /** An empty pantry (updatedAt null) when the user never saved one. */
  async execute(
    userId: string,
  ): Promise<{ ingredients: string[]; updatedAt: Date | null }> {
    const pantry = await this.pantries.find(userId);
    return pantry ?? { ingredients: [], updatedAt: null };
  }
}

export class SaveMyPantry {
  constructor(
    private readonly pantries: UserPantryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, ingredients: string[]): Promise<UserPantry> {
    const pantry = {
      userId,
      ingredients: cleanPantryIngredients(ingredients),
      updatedAt: this.clock.now(),
    };
    await this.pantries.save(pantry);
    return pantry;
  }
}

/** The pantry suggestions, using what the user saved instead of a query string. */
export class SuggestFromMyPantry {
  constructor(
    private readonly getPantry: GetMyPantry,
    private readonly suggest: SuggestFromPantry,
  ) {}

  async execute(
    userId: string,
    options: Omit<PantryQuery, 'have'>,
    visibility: DrinkVisibility,
  ): Promise<PantrySuggestion> {
    const { ingredients } = await this.getPantry.execute(userId);
    return this.suggest.execute({ ...options, have: ingredients }, visibility);
  }
}

export class AddFavorite {
  constructor(
    private readonly favorites: FavoriteRepository,
    private readonly getDrink: GetDrink,
    private readonly clock: Clock,
  ) {}

  /** The drink must exist and be visible to the user (no alcohol for minors). */
  async execute(
    userId: string,
    drinkId: string,
    visibility: DrinkVisibility,
  ): Promise<Drink> {
    const drink = await this.getDrink.execute(drinkId, visibility);
    await this.favorites.add({
      userId,
      drinkId: drink.id,
      createdAt: this.clock.now(),
    });
    return drink;
  }
}

export class RemoveFavorite {
  constructor(private readonly favorites: FavoriteRepository) {}

  execute(userId: string, drinkId: string): Promise<void> {
    return this.favorites.remove(userId, drinkId);
  }
}

export class ListFavorites {
  constructor(
    private readonly favorites: FavoriteRepository,
    private readonly catalog: DrinkCatalog,
  ) {}

  async execute(
    userId: string,
    visibility: DrinkVisibility,
  ): Promise<{ drink: Drink; addedAt: Date }[]> {
    const favorites = await this.favorites.list(userId);
    const drinks = await Promise.all(
      favorites.map((f) => this.catalog.findById(f.drinkId)),
    );
    return favorites.flatMap((favorite, i) => {
      const drink = drinks[i];
      return drink && isVisible(drink, visibility)
        ? [{ drink, addedAt: favorite.createdAt }]
        : [];
    });
  }
}

/** "Tu ADN de sabor": the user's taste, learned from their favorites. Null without favorites. */
export class GetMyTasteProfile {
  constructor(private readonly favorites: ListFavorites) {}

  async execute(
    userId: string,
    visibility: DrinkVisibility,
  ): Promise<TasteProfile | null> {
    const favorites = await this.favorites.execute(userId, visibility);
    return buildTasteProfile(favorites.map((f) => f.drink));
  }
}

/** Drinks the user hasn't favorited yet, closest to their taste, with the reasons. */
export class RecommendForMyTaste {
  constructor(
    private readonly favorites: ListFavorites,
    private readonly catalog: DrinkCatalog,
  ) {}

  async execute(
    userId: string,
    limit: number,
    visibility: DrinkVisibility,
  ): Promise<{ taste: TasteProfile; recommendations: Recommendation[] }> {
    const favorites = (await this.favorites.execute(userId, visibility)).map(
      (f) => f.drink,
    );
    const taste = buildTasteProfile(favorites);
    if (!taste) {
      throw new ValidationError(
        'Add at least one favorite drink to get recommendations',
      );
    }
    const candidates = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    return {
      taste,
      recommendations: recommendForTaste(taste, favorites, candidates, limit),
    };
  }
}
