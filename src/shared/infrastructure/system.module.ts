import { Global, Module } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Clock, IdGenerator, SlugGenerator } from '../application/ports.js';

export const CLOCK = Symbol('Clock');
export const ID_GENERATOR = Symbol('IdGenerator');
export const SLUG_GENERATOR = Symbol('SlugGenerator');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

/** 9 random bytes -> 12 base64url characters (72 bits: not guessable). */
export class RandomSlugGenerator implements SlugGenerator {
  next(): string {
    return randomBytes(9).toString('base64url');
  }
}

@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: new SystemClock() },
    { provide: ID_GENERATOR, useValue: new UuidGenerator() },
    { provide: SLUG_GENERATOR, useValue: new RandomSlugGenerator() },
  ],
  exports: [CLOCK, ID_GENERATOR, SLUG_GENERATOR],
})
export class SystemModule {}
