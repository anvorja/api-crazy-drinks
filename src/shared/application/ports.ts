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
