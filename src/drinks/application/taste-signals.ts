import { Drink, DrinkVisibility, isVisible } from '../domain/drink.js';
import { FavoriteRepository } from '../domain/personal.js';
import { ReactionRepository, isPositive } from '../domain/reactions.js';
import { DrinkCatalog } from './drink-catalog.js';

/** What the user told us about their taste, explicitly or by swiping. */
export interface TasteSignals {
  /** Favorites, likes and superlikes. */
  liked: Drink[];
  disliked: Drink[];
  /** Every drink already favorited or swiped. */
  seenIds: Set<string>;
}

export class CollectTasteSignals {
  constructor(
    private readonly favorites: FavoriteRepository,
    private readonly reactions: ReactionRepository,
    private readonly catalog: DrinkCatalog,
  ) {}

  async execute(
    userId: string,
    visibility: DrinkVisibility,
  ): Promise<TasteSignals> {
    const [favorites, reactions, drinks] = await Promise.all([
      this.favorites.list(userId),
      this.reactions.listByUser(userId),
      this.catalog.all(),
    ]);
    const byId = new Map(drinks.map((d) => [d.id, d]));

    const likedIds = new Set([
      ...favorites.map((f) => f.drinkId),
      ...reactions.filter((r) => isPositive(r.kind)).map((r) => r.drinkId),
    ]);
    const dislikedIds = reactions
      .filter((r) => !isPositive(r.kind) && !likedIds.has(r.drinkId))
      .map((r) => r.drinkId);

    const resolve = (ids: Iterable<string>) =>
      [...ids].flatMap((id) => {
        const drink = byId.get(id);
        return drink && isVisible(drink, visibility) ? [drink] : [];
      });

    return {
      liked: resolve(likedIds),
      disliked: resolve(dislikedIds),
      seenIds: new Set([...likedIds, ...dislikedIds]),
    };
  }
}
