import { Clock, SlugGenerator } from '../../../shared/application/ports.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import { DrinkVisibility, isVisible } from '../../domain/drink.js';
import { TasteProfile, buildTasteProfile } from '../../domain/taste.js';
import {
  Compatibility,
  TasteShare,
  TasteShareRepository,
  cleanDisplayName,
  compareTastes,
} from '../../domain/taste-share.js';
import { DrinkCatalog } from '../drink-catalog.js';
import { CollectTasteSignals } from '../taste-signals.js';

const NOT_SHARED = 'That taste link does not exist or was turned off';
const BRIDGE_DRINKS = 3;
// The owner's own view: a public profile shows flavors only, never which drinks.
const OWNER_VIEW: DrinkVisibility = { includeAlcoholic: true };

export class ShareMyTaste {
  constructor(
    private readonly shares: TasteShareRepository,
    private readonly signals: CollectTasteSignals,
    private readonly slugs: SlugGenerator,
    private readonly clock: Clock,
  ) {}

  /** Creates the public link, or renames it if it already exists (same slug). */
  async execute(userId: string, displayName: string): Promise<TasteShare> {
    const name = cleanDisplayName(displayName);
    const { liked, disliked } = await this.signals.execute(userId, OWNER_VIEW);
    if (!buildTasteProfile(liked, disliked)) {
      throw new ValidationError(
        'Swipe or favorite some drinks first: there is no taste to share yet',
      );
    }
    const existing = await this.shares.findByUser(userId);
    const share: TasteShare = existing
      ? { ...existing, displayName: name }
      : {
          userId,
          slug: this.slugs.next(),
          displayName: name,
          createdAt: this.clock.now(),
        };
    await this.shares.save(share);
    return share;
  }
}

export class GetMyTasteShare {
  constructor(private readonly shares: TasteShareRepository) {}

  execute(userId: string): Promise<TasteShare | null> {
    return this.shares.findByUser(userId);
  }
}

export class StopSharingMyTaste {
  constructor(private readonly shares: TasteShareRepository) {}

  execute(userId: string): Promise<void> {
    return this.shares.removeByUser(userId);
  }
}

/** Public view of a shared taste. The profile is always current. */
export class GetSharedTaste {
  constructor(
    private readonly shares: TasteShareRepository,
    private readonly signals: CollectTasteSignals,
  ) {}

  async execute(
    slug: string,
  ): Promise<{ share: TasteShare; taste: TasteProfile | null }> {
    const share = await this.shares.findBySlug(slug);
    if (!share) throw new NotFoundError(NOT_SHARED);
    const { liked, disliked } = await this.signals.execute(
      share.userId,
      OWNER_VIEW,
    );
    return { share, taste: buildTasteProfile(liked, disliked) };
  }
}

export class CompareWithSharedTaste {
  constructor(
    private readonly shares: TasteShareRepository,
    private readonly signals: CollectTasteSignals,
    private readonly catalog: DrinkCatalog,
  ) {}

  async execute(
    userId: string,
    slug: string,
    visibility: DrinkVisibility,
  ): Promise<{
    them: TasteShare;
    you: TasteProfile;
    theirs: TasteProfile;
    compatibility: Compatibility;
  }> {
    const share = await this.shares.findBySlug(slug);
    if (!share) throw new NotFoundError(NOT_SHARED);
    if (share.userId === userId)
      throw new ValidationError('That link is yours: share it with a friend');

    const [mine, theirs] = await Promise.all([
      this.signals.execute(userId, visibility),
      this.signals.execute(share.userId, OWNER_VIEW),
    ]);
    const you = buildTasteProfile(mine.liked, mine.disliked);
    const them = buildTasteProfile(theirs.liked, theirs.disliked);
    if (!you)
      throw new ValidationError(
        'Swipe or favorite some drinks first to compare',
      );
    if (!them)
      throw new ValidationError(
        `${share.displayName} has no taste profile yet`,
      );

    // Bridges must be visible to the viewer (no alcohol for minors) and new to both.
    const seen = new Set([...mine.seenIds, ...theirs.seenIds]);
    const candidates = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    return {
      them: share,
      you,
      theirs: them,
      compatibility: compareTastes(you, them, candidates, seen, BRIDGE_DRINKS),
    };
  }
}
