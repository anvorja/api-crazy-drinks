import { measureToMl } from './measure.js';

describe('measureToMl', () => {
  it.each([
    ['1 1/2 oz', 44.36],
    ['1/2 oz', 14.79],
    ['2 cl', 20],
    ['30 ml', 30],
    ['1 shot', 44],
    ['2-3 dashes', 2.3],
    ['1 tsp', 4.93],
    ['2 parts', 60],
  ])('%s -> %d ml', (measure, ml) => {
    expect(measureToMl(measure)).toBeCloseTo(ml, 1);
  });

  it.each([null, 'Juice of 1/2', '1 wedge', 'Garnish with', 'to taste'])(
    '%s is not a volume',
    (measure) => {
      expect(measureToMl(measure)).toBeNull();
    },
  );
});
