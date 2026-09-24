import { Resvg } from '@resvg/resvg-js';
import { FLAVOR_DIMENSIONS, FlavorDimension } from '../../domain/flavor.js';
import { TasteProfile } from '../../domain/taste.js';
import { ingredientEs } from '../../domain/translations.js';

/** Open Graph size: what WhatsApp, X, LinkedIn and Instagram previews expect. */
const WIDTH = 1200;
const HEIGHT = 630;
const FONT = 'DejaVu Sans';
/** Bundled (see assets/fonts/LICENSE-DejaVu.txt): scanning system fonts takes seconds. */
const FONT_FILES = [
  'assets/fonts/DejaVuSans.ttf',
  'assets/fonts/DejaVuSans-Bold.ttf',
];

const LABELS: Record<FlavorDimension, string> = {
  sweet: 'Dulce',
  sour: 'Ácido',
  bitter: 'Amargo',
  strong: 'Intenso',
  fruity: 'Frutal',
  herbal: 'Herbal',
  creamy: 'Cremoso',
  fizzy: 'Burbujeante',
  spicy: 'Picante',
};

const CONFIDENCE: Record<TasteProfile['confidence'], string> = {
  low: 'baja',
  medium: 'media',
  high: 'alta',
};

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Greedy word wrap for SVG text (no automatic wrapping there). */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  return line ? [...lines, line] : lines;
}

function radar(
  taste: TasteProfile,
  cx: number,
  cy: number,
  radius: number,
): string {
  const n = FLAVOR_DIMENSIONS.length;
  const point = (i: number, r: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)].map((v) =>
      v.toFixed(1),
    );
  };
  const ring = (fraction: number) =>
    FLAVOR_DIMENSIONS.map((_, i) => point(i, radius * fraction).join(',')).join(
      ' ',
    );

  const grid = [0.25, 0.5, 0.75, 1]
    .map(
      (f) =>
        `<polygon points="${ring(f)}" fill="none" stroke="#ffffff" stroke-opacity="0.15"/>`,
    )
    .join('');
  const axes = FLAVOR_DIMENSIONS.map((_, i) => {
    const [x, y] = point(i, radius);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#ffffff" stroke-opacity="0.12"/>`;
  }).join('');
  const shape = FLAVOR_DIMENSIONS.map((d, i) =>
    point(i, (radius * Math.max(taste.profile[d], 4)) / 100).join(','),
  ).join(' ');
  const labels = FLAVOR_DIMENSIONS.map((d, i) => {
    const [x, y] = point(i, radius + 34);
    const strong = taste.dominant.includes(d);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="19" fill="${strong ? '#ffb86b' : '#ffffff'}" fill-opacity="${strong ? 1 : 0.7}" font-weight="${strong ? 'bold' : 'normal'}">${LABELS[d]}</text>`;
  }).join('');

  return `${grid}${axes}<polygon points="${shape}" fill="#ff7a59" fill-opacity="0.45" stroke="#ffb86b" stroke-width="3" stroke-linejoin="round"/>${labels}`;
}

/** The shareable "ADN de sabor" card, as SVG. */
export function renderTasteCardSvg(
  displayName: string,
  taste: TasteProfile | null,
): string {
  // The text column is ~550px wide: ~19 chars at 44px bold, ~40 chars at 22px.
  const x = 610;
  const personality = (
    taste ? wrap(taste.personality, 19) : ['Aún sin ADN de sabor']
  ).slice(0, 3);
  const ingredients = taste
    ? wrap(
        `Le encanta: ${taste.favoriteIngredients
          .slice(0, 4)
          .map((i) => ingredientEs(i.ingredient) ?? i.ingredient)
          .join(' · ')}`,
        40,
      ).slice(0, 2)
    : [];
  const name =
    displayName.length > 26 ? `${displayName.slice(0, 25)}…` : displayName;

  const personalityText = personality
    .map(
      (line, i) =>
        `<text x="${x}" y="${250 + i * 54}" font-size="44" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    .join('');
  const after = 250 + personality.length * 54 + 10;
  const ingredientsText = ingredients
    .map(
      (line, i) =>
        `<text x="${x}" y="${after + 30 + i * 30}" font-size="22" fill="#ffffff" fill-opacity="0.75">${escapeXml(line)}</text>`,
    )
    .join('');
  const basedOn = taste
    ? `<text x="${x}" y="${after + 40 + ingredients.length * 30}" font-size="20" fill="#ffffff" fill-opacity="0.55">Basado en ${taste.basedOn} bebidas · confianza ${CONFIDENCE[taste.confidence]}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${FONT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b1036"/>
      <stop offset="1" stop-color="#4a1248"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  ${taste ? radar(taste, 300, 330, 190) : ''}
  <text x="${x}" y="120" font-size="22" letter-spacing="4" fill="#ffb86b">ADN DE SABOR</text>
  <text x="${x}" y="172" font-size="36" fill="#ffffff" fill-opacity="0.85">${escapeXml(name)}</text>
  ${personalityText}
  ${ingredientsText}
  ${basedOn}
  <text x="${WIDTH - 40}" y="${HEIGHT - 36}" text-anchor="end" font-size="20" fill="#ffffff" fill-opacity="0.5">api-drinks · ¿qué tan compatibles somos?</text>
</svg>`;
}

/** Same card as PNG, for previews that don't support SVG. */
export function renderTasteCardPng(svg: string): Buffer {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: {
      loadSystemFonts: false,
      fontFiles: FONT_FILES,
      defaultFontFamily: FONT,
    },
  })
    .render()
    .asPng();
}
