import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RateLimitedError } from '../../domain/errors.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import type { RateLimitStore } from './rate-limit.store.js';

export const RATE_LIMIT_STORE = Symbol('RateLimitStore');

/** Not limited: infrastructure probes, docs, and provider webhooks (already signed). */
const EXEMPT = /^\/(health|docs)(\/|$)|^\/v\d+\/webhooks\//;
/** Expensive per request: image rendering, and search-as-you-type. */
const HEAVY = /\/card\.(png|svg)$|\/drinks\/suggest$/;

/**
 * Fixed-window limit per client IP, before any other work (auth, database). Two buckets:
 * general and heavy. Answers 429 RATE_LIMITED with Retry-After and RateLimit-* headers.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private lastPrune = 0;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Mounted with a wildcard, req.path is relative to it: use the full URL without the query.
    const path = req.originalUrl.split('?')[0];
    if (
      !this.env.RATE_LIMIT_ENABLED ||
      req.method === 'OPTIONS' ||
      EXEMPT.test(path)
    ) {
      return next();
    }
    const windowMs = this.env.RATE_LIMIT_WINDOW_SECONDS * 1000;
    const now = Date.now();
    const windowStart = new Date(now - (now % windowMs));
    const heavy = HEAVY.test(path);
    const limit = heavy
      ? this.env.RATE_LIMIT_HEAVY_MAX
      : this.env.RATE_LIMIT_MAX;

    let hits: number;
    try {
      hits = await this.store.hit(
        `${heavy ? 'heavy' : 'all'}:${req.ip}`,
        windowStart,
      );
    } catch (error) {
      // The limiter must never take the API down: fail open and log.
      this.logger.warn(`Rate limit store unavailable: ${String(error)}`);
      return next();
    }
    this.pruneOccasionally(now, windowMs);

    const resetSeconds = Math.ceil(
      (windowStart.getTime() + windowMs - now) / 1000,
    );
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(limit - hits, 0)));
    res.setHeader('RateLimit-Reset', String(resetSeconds));
    if (hits > limit) {
      throw new RateLimitedError('Too many requests, slow down', resetSeconds);
    }
    next();
  }

  private pruneOccasionally(now: number, windowMs: number): void {
    if (now - this.lastPrune < windowMs) return;
    this.lastPrune = now;
    this.store.prune(new Date(now - 2 * windowMs)).catch(() => undefined);
  }
}
