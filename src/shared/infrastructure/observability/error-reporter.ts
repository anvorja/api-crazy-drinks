import * as Sentry from '@sentry/node';

/** Where unexpected errors go besides the log. */
export interface ErrorReporter {
  report(
    error: unknown,
    context: { requestId?: string; method?: string; path?: string },
  ): void;
}

export const ERROR_REPORTER = Symbol('ErrorReporter');

export class NoopErrorReporter implements ErrorReporter {
  report(): void {}
}

/** Sentry (https://sentry.io), enabled with SENTRY_DSN. */
export class SentryErrorReporter implements ErrorReporter {
  constructor(settings: { dsn: string; environment: string; release: string }) {
    Sentry.init({
      dsn: settings.dsn,
      environment: settings.environment,
      release: settings.release,
    });
  }

  report(
    error: unknown,
    context: { requestId?: string; method?: string; path?: string },
  ): void {
    Sentry.withScope((scope) => {
      if (context.requestId) scope.setTag('request_id', context.requestId);
      if (context.method && context.path)
        scope.setTag('route', `${context.method} ${context.path}`);
      Sentry.captureException(error);
    });
  }
}
