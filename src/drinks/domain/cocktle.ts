import { ConflictError, ValidationError } from '../../shared/domain/errors.js';
import { Drink, ingredientKeys } from './drink.js';
import { cosine, flavorDna, flavorVector } from './flavor.js';
import { SIDES, joinSpanish } from './taste.js';
import { categoryEs, glassEs, ingredientEs } from './translations.js';

/** classic: the whole catalog (adults); zero: alcohol-free, for everyone. */
export const COCKTLE_MODES = ['classic', 'zero'] as const;
export type CocktleMode = (typeof COCKTLE_MODES)[number];

export const MAX_ATTEMPTS = 6;
/** Answers need enough ingredients for the clues to make sense. */
const MIN_INGREDIENTS = 3;

/** A player's game of one day and mode. */
export interface CocktleGame {
  userId: string;
  day: string;
  mode: CocktleMode;
  /** Drink ids, in order. */
  guesses: string[];
  solved: boolean;
}

export interface CocktleGameRepository {
  find(
    userId: string,
    day: string,
    mode: CocktleMode,
  ): Promise<CocktleGame | null>;
  save(game: CocktleGame): Promise<void>;
  listByUser(userId: string, mode: CocktleMode): Promise<CocktleGame[]>;
}

export interface Clue {
  kind:
    | 'flavor'
    | 'profile'
    | 'glass'
    | 'ingredients'
    | 'more-ingredients'
    | 'name';
  text: string;
}

export type Heat = 'correct' | 'hot' | 'warm' | 'cold';

export interface GuessFeedback {
  drink: Drink;
  correct: boolean;
  /** 0-100 flavor similarity with the answer. */
  closeness: number;
  sharedIngredients: string[];
  sameCategory: boolean;
  sameGlass: boolean;
  heat: Heat;
}

export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

export const isFinished = (game: CocktleGame) =>
  game.solved || game.guesses.length >= MAX_ATTEMPTS;

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Same answer for everyone on a given UTC day and mode; independent of the drink of the day. */
export function pickCocktleAnswer(
  drinks: Drink[],
  day: string,
  mode: CocktleMode,
): Drink | undefined {
  const pool = drinks
    .filter(
      (d) =>
        d.ingredients.length >= MIN_INGREDIENTS &&
        (mode === 'classic' || !d.alcoholic),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  return pool[hash(`cocktle:${mode}:${day}`) % pool.length];
}

const STRENGTHS = {
  zero: 'nula',
  light: 'suave',
  medium: 'media',
  strong: 'alta',
} as const;

const translated = (name: string) => ingredientEs(name) ?? name;

/** Name shape: "M _ _ _ _ _ _ _ _" keeping spaces and symbols. */
const graphemes = new Intl.Segmenter('es', { granularity: 'grapheme' });

const nameShape = (name: string) =>
  Array.from(graphemes.segment(name), ({ segment }) => segment)
    .map((ch, i) =>
      i === 0 ? ch.toUpperCase() : /[\p{L}\p{N}]/u.test(ch) ? '_' : ch,
    )
    .join(' ');

/** Clue i (0-based) becomes visible after i wrong guesses; from abstract to concrete. */
export function cluesFor(answer: Drink): Clue[] {
  const dna = flavorDna(answer);
  const ingredients = answer.ingredients.map((i) => translated(i.name));
  const traits = dna.dominant.length
    ? joinSpanish(dna.dominant.map((d) => SIDES[d]))
    : 'equilibrado';
  return [
    {
      kind: 'flavor',
      text: `Su ADN de sabor: ${dna.personality} (lado ${traits})`,
    },
    {
      kind: 'profile',
      text: `${categoryEs(answer.category) ?? answer.category ?? 'Sin categoría'} · ${answer.alcoholic ? `intensidad ${STRENGTHS[dna.strength]}` : 'sin alcohol'}`,
    },
    {
      kind: 'glass',
      text: `Se sirve en: ${glassEs(answer.glass) ?? answer.glass ?? 'cualquier vaso'}`,
    },
    {
      kind: 'ingredients',
      text: `Tiene ${answer.ingredients.length} ingredientes, entre ellos: ${ingredients[0]}`,
    },
    {
      kind: 'more-ingredients',
      text: `También lleva: ${joinSpanish(ingredients.slice(1, 3))}`,
    },
    { kind: 'name', text: `Su nombre: ${nameShape(answer.name)}` },
  ];
}

export function feedbackFor(guess: Drink, answer: Drink): GuessFeedback {
  const correct = guess.id === answer.id;
  const closeness = correct
    ? 100
    : Math.round(cosine(flavorVector(guess), flavorVector(answer)) * 100);
  const answerKeys = ingredientKeys(answer);
  return {
    drink: guess,
    correct,
    closeness,
    sharedIngredients: [...ingredientKeys(guess)].filter((k) =>
      answerKeys.has(k),
    ),
    sameCategory: guess.category === answer.category,
    sameGlass: guess.glass === answer.glass,
    heat: correct
      ? 'correct'
      : closeness >= 80
        ? 'hot'
        : closeness >= 50
          ? 'warm'
          : 'cold',
  };
}

/** Applies a guess to a game. Throws when the game is over or the drink was already tried. */
export function applyGuess(
  game: CocktleGame,
  guess: Drink,
  answer: Drink,
): CocktleGame {
  if (isFinished(game))
    throw new ConflictError('This game is over: come back tomorrow');
  if (game.guesses.includes(guess.id))
    throw new ValidationError(`You already tried ${guess.name}`);
  return {
    ...game,
    guesses: [...game.guesses, guess.id],
    solved: guess.id === answer.id,
  };
}

const HEAT_EMOJI: Record<Heat, string> = {
  correct: '🟩',
  hot: '🟨',
  warm: '🟧',
  cold: '🟥',
};

/** Spoiler-free result to share: "Cocktle 2026-09-24 · 3/6\n🟥🟨🟩". */
export function shareText(
  game: CocktleGame,
  feedback: GuessFeedback[],
): string {
  const mode = game.mode === 'zero' ? ' · 0 %' : '';
  const score = game.solved ? game.guesses.length : 'X';
  return `Cocktle ${game.day}${mode} · ${score}/${MAX_ATTEMPTS}\n${feedback.map((f) => HEAT_EMOJI[f.heat]).join('')}`;
}

export interface CocktleStats {
  played: number;
  won: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  /** Wins by number of attempts, index 0 = solved at the first try. */
  distribution: number[];
}

const previousDay = (day: string) =>
  utcDay(new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000));

/** Streaks count consecutive won days; today not played yet doesn't break it. */
export function statsFor(games: CocktleGame[], today: string): CocktleStats {
  const finished = games.filter(isFinished);
  const won = finished.filter((g) => g.solved);
  const wonDays = new Set(won.map((g) => g.day));

  let maxStreak = 0;
  let run = 0;
  for (const day of [...wonDays].sort()) {
    run = wonDays.has(previousDay(day)) ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
  }

  let currentStreak = 0;
  let day = wonDays.has(today) ? today : previousDay(today);
  while (wonDays.has(day)) {
    currentStreak++;
    day = previousDay(day);
  }

  const distribution = Array.from({ length: MAX_ATTEMPTS }, () => 0);
  for (const game of won) distribution[game.guesses.length - 1]++;

  return {
    played: finished.length,
    won: won.length,
    winRate: finished.length
      ? Math.round((won.length / finished.length) * 100)
      : 0,
    currentStreak,
    maxStreak,
    distribution,
  };
}
