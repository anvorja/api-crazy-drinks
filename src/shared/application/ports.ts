export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

/** Short, URL-safe, unguessable identifiers for public links. */
export interface SlugGenerator {
  next(): string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends email (SMTP in production, the log in development). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
