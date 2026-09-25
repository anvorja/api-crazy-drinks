import { Clock } from '../../../shared/application/ports.js';
import { Drink, DrinkVisibility, isVisible } from '../../domain/drink.js';
import { FavoriteRepository } from '../../domain/personal.js';
import {
  Reaction,
  ReactionKind,
  ReactionRepository,
  pickDiscoverDeck,
} from '../../domain/reactions.js';
import { TasteProfile, buildTasteProfile } from '../../domain/taste.js';
import { DrinkCatalog } from '../drink-catalog.js';
import { CollectTasteSignals } from '../taste-signals.js';
import { GetDrink } from './drink-queries.js';

/** Next cards to swipe. */
export class GetDiscoverDeck {
  constructor(
    private readonly signals: CollectTasteSignals,
    private readonly catalog: DrinkCatalog,
    private readonly random: () => number = Math.random,
  ) {}

  async execute(
    userId: string,
    count: number,
    visibility: DrinkVisibility,
  ): Promise<Drink[]> {
    const { liked, disliked, seenIds } = await this.signals.execute(
      userId,
      visibility,
    );
    const candidates = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    return pickDiscoverDeck(
      candidates,
      seenIds,
      buildTasteProfile(liked, disliked),
      count,
      this.random,
    );
  }
}

/**
 * Records a swipe (replacing any previous one for that drink); a superlike also saves it
 * as a favorite. Returns the updated taste so the UI can show it change live.
 */
export class ReactToDrink {
  constructor(
    private readonly reactions: ReactionRepository,
    private readonly favorites: FavoriteRepository,
    private readonly getDrink: GetDrink,
    private readonly signals: CollectTasteSignals,
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    drinkId: string,
    kind: ReactionKind,
    visibility: DrinkVisibility,
  ): Promise<{ reaction: Reaction; taste: TasteProfile | null }> {
    const drink = await this.getDrink.execute(drinkId, visibility);
    const now = this.clock.now();
    const reaction: Reaction = {
      userId,
      drinkId: drink.id,
      kind,
      createdAt: now,
    };
    await this.reactions.save(reaction);
    if (kind === 'superlike') {
      await this.favorites.add({ userId, drinkId: drink.id, createdAt: now });
    }
    const { liked, disliked } = await this.signals.execute(userId, visibility);
    return { reaction, taste: buildTasteProfile(liked, disliked) };
  }
}

export class UndoReaction {
  constructor(private readonly reactions: ReactionRepository) {}

  execute(userId: string, drinkId: string): Promise<void> {
    return this.reactions.remove(userId, drinkId);
  }
}

export interface DiscoverStats {
  likes: number;
  dislikes: number;
  superlikes: number;
  swiped: number;
}

export class GetDiscoverStats {
  constructor(private readonly reactions: ReactionRepository) {}

  async execute(userId: string): Promise<DiscoverStats> {
    const reactions = await this.reactions.listByUser(userId);
    const count = (kind: ReactionKind) =>
      reactions.filter((r) => r.kind === kind).length;
    return {
      likes: count('like'),
      dislikes: count('dislike'),
      superlikes: count('superlike'),
      swiped: reactions.length,
    };
  }
}
