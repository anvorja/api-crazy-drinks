import { Drink } from '../../../drinks/domain/drink.js';

/** What venues need from the drinks context. */
export interface VenueDrinkCatalog {
  all(): Promise<Drink[]>;
}
