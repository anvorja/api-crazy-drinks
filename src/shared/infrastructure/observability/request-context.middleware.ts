import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { Metrics } from './metrics.js';

export type RequestWithId = Request & {
  id?: string;
  principal?: { userId: string } | null;
};

/** Accept the caller's id (e.g. from a load balancer) only if it looks sane. */
const VALID_ID = /^[\w.:-]{8,128}$/;
/** Probes and scrapes would drown the access log. */
const QUIET = /^\/(health|metrics)(\/|$)/;

/**
 * First on every request: gives it an id (X-Request-Id, echoed in the response and in error
 * bodies), and when it finishes writes one access log line and records metrics.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: Metrics) {}

  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    req.id =
      typeof incoming === 'string' && VALID_ID.test(incoming)
        ? incoming
        : randomUUID();
    res.setHeader('X-Request-Id', req.id);

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      const path = req.originalUrl.split('?')[0];
      // The route pattern (/v1/drinks/:id), never the raw URL: bounded metric labels.
      const route =
        (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
      this.metrics.observe(req.method, route, res.statusCode, seconds);
      if (QUIET.test(path)) return;
      this.logger.log({
        msg: 'request',
        requestId: req.id,
        method: req.method,
        path,
        route,
        status: res.statusCode,
        durationMs: Math.round(seconds * 1000),
        userId: req.principal?.userId ?? null,
      });
    });
    next();
  }
}
