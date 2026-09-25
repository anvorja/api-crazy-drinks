import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/** Invalid body, query or params: carries one entry per problem. */
export class ValidationFailedException extends BadRequestException {
  constructor(readonly details: { path: string; message: string }[]) {
    super('The request is not valid');
  }
}

/** Validates and transforms request input (body, query, params) with a zod schema. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationFailedException(
        result.error.issues.map((i) => ({
          path: i.path.join('.') || 'value',
          message: i.message,
        })),
      );
    }
    return result.data;
  }
}
