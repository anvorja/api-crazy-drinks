import { Clock } from '../../../shared/application/ports.js';
import {
  ForbiddenError,
  NotFoundError,
  UnavailableError,
} from '../../../shared/domain/errors.js';
import {
  Clue,
  CocktleGame,
  CocktleGameRepository,
  CocktleMode,
  CocktleStats,
  GuessFeedback,
  MAX_ATTEMPTS,
  applyGuess,
  cluesFor,
  feedbackFor,
  isFinished,
  pickCocktleAnswer,
  shareText,
  statsFor,
  utcDay,
} from '../../domain/cocktle.js';
import { Drink, DrinkVisibility, isVisible } from '../../domain/drink.js';
import { DrinkCatalog } from '../drink-catalog.js';

export interface CocktleState {
  day: string;
  mode: CocktleMode;
  maxAttempts: number;
  attemptsLeft: number;
  clues: Clue[];
  guesses: GuessFeedback[];
  finished: boolean;
  solved: boolean;
  /** Only once the game is over. */
  answer: Drink | null;
  share: string | null;
}

/** The daily puzzle for a mode, and the pieces every Cocktle use case needs. */
class CocktlePuzzle {
  constructor(
    private readonly catalog: DrinkCatalog,
    private readonly clock: Clock,
  ) {}

  async load(mode: CocktleMode, visibility: DrinkVisibility) {
    if (mode === 'classic' && !visibility.includeAlcoholic) {
      throw new ForbiddenError(
        'Classic mode includes alcohol: play mode "zero" instead',
        'AGE_RESTRICTED',
      );
    }
    const day = utcDay(this.clock.now());
    const drinks = await this.catalog.all();
    const answer = pickCocktleAnswer(drinks, day, mode);
    if (!answer) throw new UnavailableError('No puzzle available today');
    const byId = new Map(drinks.map((d) => [d.id, d]));
    return { day, answer, byId };
  }
}

function stateOf(
  game: CocktleGame,
  answer: Drink,
  byId: Map<string, Drink>,
): CocktleState {
  const guesses = game.guesses.flatMap((id) => {
    const drink = byId.get(id);
    return drink ? [feedbackFor(drink, answer)] : [];
  });
  const finished = isFinished(game);
  const clues = cluesFor(answer);
  return {
    day: game.day,
    mode: game.mode,
    maxAttempts: MAX_ATTEMPTS,
    attemptsLeft: MAX_ATTEMPTS - game.guesses.length,
    // One clue at the start, one more after each miss; everything once it's over.
    clues: finished ? clues : clues.slice(0, game.guesses.length + 1),
    guesses,
    finished,
    solved: game.solved,
    answer: finished ? answer : null,
    share: finished ? shareText(game, guesses) : null,
  };
}

export class GetTodayCocktle {
  private readonly puzzle: CocktlePuzzle;

  constructor(
    private readonly games: CocktleGameRepository,
    catalog: DrinkCatalog,
    clock: Clock,
  ) {
    this.puzzle = new CocktlePuzzle(catalog, clock);
  }

  async execute(
    userId: string,
    mode: CocktleMode,
    visibility: DrinkVisibility,
  ): Promise<CocktleState> {
    const { day, answer, byId } = await this.puzzle.load(mode, visibility);
    const game = (await this.games.find(userId, day, mode)) ?? {
      userId,
      day,
      mode,
      guesses: [],
      solved: false,
    };
    return stateOf(game, answer, byId);
  }
}

export class GuessCocktle {
  private readonly puzzle: CocktlePuzzle;

  constructor(
    private readonly games: CocktleGameRepository,
    catalog: DrinkCatalog,
    clock: Clock,
  ) {
    this.puzzle = new CocktlePuzzle(catalog, clock);
  }

  async execute(
    userId: string,
    mode: CocktleMode,
    drinkId: string,
    visibility: DrinkVisibility,
  ): Promise<CocktleState> {
    const { day, answer, byId } = await this.puzzle.load(mode, visibility);
    const guess = byId.get(drinkId);
    if (!guess || !isVisible(guess, visibility))
      throw new NotFoundError(`Drink ${drinkId} not found`, 'DRINK_NOT_FOUND');

    const current = (await this.games.find(userId, day, mode)) ?? {
      userId,
      day,
      mode,
      guesses: [],
      solved: false,
    };
    const next = applyGuess(current, guess, answer);
    await this.games.save(next);
    return stateOf(next, answer, byId);
  }
}

export class GetCocktleStats {
  constructor(
    private readonly games: CocktleGameRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, mode: CocktleMode): Promise<CocktleStats> {
    return statsFor(
      await this.games.listByUser(userId, mode),
      utcDay(this.clock.now()),
    );
  }
}
