import { Logger } from '@nestjs/common';
import { UnavailableError } from '../../../shared/domain/errors.js';
import { DrinkSource } from '../../application/ports/drink-source.port.js';
import { Drink } from '../../domain/drink.js';
import { CocktailDbDrinkDto, CocktailDbResponseDto } from './cocktaildb.dto.js';
import { toDomainDrink } from './cocktaildb.mapper.js';

export interface CocktailDbConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  crawlConcurrency: number;
  /** Extra attempts per request on timeouts/5xx, with linear backoff. */
  retries: number;
  /** Base for ingredient pictures, e.g. https://www.thecocktaildb.com/images */
  imagesBaseUrl: string;
}

// The free API has no "list all": the catalog is crawled by first letter.
const INDEX_KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

/** DrinkSource adapter for TheCocktailDB (https://www.thecocktaildb.com/api.php). */
export class CocktailDbSource implements DrinkSource {
  private readonly logger = new Logger(CocktailDbSource.name);

  constructor(private readonly config: CocktailDbConfig) {}

  async fetchAll(): Promise<Drink[]> {
    const found = new Map<string, Drink>();
    const queue = [...INDEX_KEYS];
    const worker = async () => {
      for (let key = queue.shift(); key; key = queue.shift()) {
        for (const dto of await this.getDrinks('search.php', { f: key })) {
          const drink = toDomainDrink(dto, this.config.imagesBaseUrl);
          found.set(drink.id, drink);
        }
      }
    };
    await Promise.all(
      Array.from({ length: this.config.crawlConcurrency }, worker),
    );
    this.logger.log(`Fetched ${found.size} drinks from TheCocktailDB`);
    return [...found.values()];
  }

  async findById(id: string): Promise<Drink | null> {
    const [dto] = await this.getDrinks('lookup.php', { i: id });
    return dto ? toDomainDrink(dto, this.config.imagesBaseUrl) : null;
  }

  async searchByName(query: string): Promise<Drink[]> {
    return (await this.getDrinks('search.php', { s: query })).map((dto) =>
      toDomainDrink(dto, this.config.imagesBaseUrl),
    );
  }

  async random(): Promise<Drink | null> {
    const [dto] = await this.getDrinks('random.php', {});
    return dto ? toDomainDrink(dto, this.config.imagesBaseUrl) : null;
  }

  async ping(): Promise<number> {
    const started = performance.now();
    await this.request('list.php', { g: 'list' });
    return Math.round(performance.now() - started);
  }

  private async getDrinks(
    path: string,
    params: Record<string, string>,
  ): Promise<CocktailDbDrinkDto[]> {
    const body = await this.request(path, params);
    return Array.isArray(body?.drinks) ? body.drinks : [];
  }

  private async request(
    path: string,
    params: Record<string, string>,
  ): Promise<CocktailDbResponseDto | null> {
    const { baseUrl, apiKey, timeoutMs } = this.config;
    const url = `${baseUrl}/${apiKey}/${path}?${new URLSearchParams(params).toString()}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return text ? (JSON.parse(text) as CocktailDbResponseDto) : null;
    } catch (error) {
      this.logger.warn(
        `TheCocktailDB request failed (${path}): ${String(error)}`,
      );
      throw new UnavailableError('TheCocktailDB is not reachable right now');
    }
  }
}
