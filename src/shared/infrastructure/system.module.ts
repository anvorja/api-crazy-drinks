import { Global, Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Clock, IdGenerator } from '../application/ports.js';

export const CLOCK = Symbol('Clock');
export const ID_GENERATOR = Symbol('IdGenerator');

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

@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: new SystemClock() },
    { provide: ID_GENERATOR, useValue: new UuidGenerator() },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class SystemModule {}
