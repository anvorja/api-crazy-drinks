import { MailMessage, Mailer } from '../../src/shared/application/ports.js';

/** Keeps sent emails so tests can read them (e.g. the reset link). */
export class FakeMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  lastTo(email: string): MailMessage | undefined {
    return this.sent.filter((m) => m.to === email).at(-1);
  }

  /** The token of the last reset link sent to an address. */
  resetTokenFor(email: string): string | undefined {
    const match = this.lastTo(email)?.text.match(/[?&]token=([^\s&]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }
}
