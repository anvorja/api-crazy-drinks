import { normalizeText } from '../../shared/domain/text.js';
import { Drink } from './drink.js';
import { FLAVOR_DIMENSIONS, FlavorVector, flavorVector } from './flavor.js';

export interface Mood {
  key: string;
  aliases: string[];
  description: string;
  /** undefined = any; true/false forces alcoholic or alcohol-free drinks. */
  alcoholic?: boolean;
  weights: Partial<FlavorVector>;
}

export const MOODS: Mood[] = [
  {
    key: 'happy',
    aliases: ['feliz', 'alegre'],
    description: 'Frutal, dulce y con burbujas para celebrar que sí.',
    weights: { fruity: 1, sweet: 0.7, fizzy: 0.8, bitter: -0.5 },
  },
  {
    key: 'sad',
    aliases: ['triste', 'melancolico'],
    description: 'Cremoso y reconfortante, un abrazo en vaso.',
    weights: { creamy: 1, sweet: 0.8, bitter: -0.3 },
  },
  {
    key: 'romantic',
    aliases: ['romantico', 'cita'],
    description: 'Elegante, afrutado y con un toque de chispa.',
    weights: { fruity: 0.8, fizzy: 0.6, sweet: 0.5, spicy: -0.5 },
  },
  {
    key: 'adventurous',
    aliases: ['aventurero', 'atrevido'],
    description: 'Amargo, herbal o picante: para salir de la zona de confort.',
    weights: { bitter: 1, herbal: 0.9, spicy: 1, sweet: -0.4 },
  },
  {
    key: 'chill',
    aliases: ['relajado', 'tranqui'],
    description: 'Ligero, fresco y herbal para bajar revoluciones.',
    weights: { herbal: 0.9, fizzy: 0.7, sour: 0.4, strong: -0.8 },
  },
  {
    key: 'party',
    aliases: ['fiesta', 'rumba'],
    description: 'Fuerte y dulce: la noche es joven.',
    alcoholic: true,
    weights: { strong: 1, sweet: 0.6, fizzy: 0.4 },
  },
  {
    key: 'focused',
    aliases: ['concentrado', 'trabajando'],
    description: 'Cero alcohol, cítrico y herbal para seguir en modo foco.',
    alcoholic: false,
    weights: { sour: 0.8, herbal: 0.8, sweet: -0.3 },
  },
  {
    key: 'hungover',
    aliases: ['guayabo', 'resaca', 'crudo'],
    description: 'Sin alcohol, ácido y picante para resucitar.',
    alcoholic: false,
    weights: { sour: 1, spicy: 0.8, fizzy: 0.5, creamy: -0.5 },
  },
];

export const findMood = (input: string): Mood | undefined => {
  const q = normalizeText(input);
  return MOODS.find((m) => m.key === q || m.aliases.includes(q));
};

/** Drinks ordered from best to worst fit for the mood. */
export function rankByMood(drinks: Drink[], mood: Mood): Drink[] {
  return drinks
    .filter(
      (d) => mood.alcoholic === undefined || d.alcoholic === mood.alcoholic,
    )
    .map((drink) => {
      const dna = flavorVector(drink);
      const score = FLAVOR_DIMENSIONS.reduce(
        (sum, dim) => sum + dna[dim] * (mood.weights[dim] ?? 0),
        0,
      );
      return { drink, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ drink }) => drink);
}
