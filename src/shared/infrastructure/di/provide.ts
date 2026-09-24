import { InjectionToken, Provider } from '@nestjs/common';

/** Registers a framework-agnostic class (use case, adapter) built by a factory. */
export const provide = <T>(
  token: InjectionToken<T>,
  factory: (...deps: any[]) => T,
  inject: InjectionToken[] = [],
): Provider => ({ provide: token, useFactory: factory, inject });
