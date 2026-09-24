import { toDomainDrink } from './cocktaildb.mapper.js';

describe('toDomainDrink', () => {
  it('maps the flat upstream dto into a clean domain drink', () => {
    const drink = toDomainDrink({
      idDrink: '11007',
      strDrink: 'Margarita',
      strAlcoholic: 'Alcoholic',
      strTags: 'IBA, ContemporaryClassic',
      strInstructions: 'Shake.',
      strInstructionsES: 'Agitar.',
      strIngredient1: 'Tequila',
      strMeasure1: '1 1/2 oz ',
      strIngredient2: 'Lime juice',
      strMeasure2: null,
      strIngredient3: '',
    });

    expect(drink).toMatchObject({
      id: '11007',
      name: 'Margarita',
      alcoholic: true,
      tags: ['IBA', 'ContemporaryClassic'],
      instructions: { en: 'Shake.', es: 'Agitar.' },
      ingredients: [
        { name: 'Tequila', measure: '1 1/2 oz' },
        { name: 'Lime juice', measure: null },
      ],
    });
  });

  it('detects alcohol-free drinks', () => {
    expect(
      toDomainDrink({ idDrink: '1', strAlcoholic: 'Non alcoholic' }).alcoholic,
    ).toBe(false);
  });
});
