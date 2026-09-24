import { ErrorReporter } from '../../src/shared/infrastructure/observability/error-reporter.js';

export class FakeErrorReporter implements ErrorReporter {
  readonly reported: { error: unknown; requestId?: string }[] = [];

  report(error: unknown, context: { requestId?: string }): void {
    this.reported.push({ error, requestId: context.requestId });
  }
}
