import { drinkImageSizes } from './image-sizes.js';

describe('drinkImageSizes', () => {
  it('derives the sizes of a Cloudinary picture with transformations', () => {
    const base = 'https://res.cloudinary.com/demo/image/upload';
    expect(drinkImageSizes(`${base}/cocktailDB/drinks/11000`)).toEqual({
      small: `${base}/c_fill,w_200,h_200,f_auto,q_auto/cocktailDB/drinks/11000`,
      medium: `${base}/c_fill,w_350,h_350,f_auto,q_auto/cocktailDB/drinks/11000`,
      large: `${base}/c_fill,w_500,h_500,f_auto,q_auto/cocktailDB/drinks/11000`,
    });
  });

  it("uses TheCocktailDB's suffixes for its own pictures", () => {
    expect(drinkImageSizes('https://img/5.jpg')).toEqual({
      small: 'https://img/5.jpg/small',
      medium: 'https://img/5.jpg/medium',
      large: 'https://img/5.jpg/large',
    });
    expect(drinkImageSizes(null)).toBeNull();
  });
});
