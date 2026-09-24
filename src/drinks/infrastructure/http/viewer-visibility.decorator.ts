import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { canSeeAlcohol } from '../../../identity/domain/principal.js';
import { principalFrom } from '../../../identity/infrastructure/http/auth.decorators.js';
import { DrinkVisibility } from '../../domain/drink.js';

/** Which drinks the current viewer may see: alcohol only for authenticated adults. */
export const ViewerVisibility = createParamDecorator(
  (_: unknown, context: ExecutionContext): DrinkVisibility => ({
    includeAlcoholic: canSeeAlcohol(principalFrom(context)),
  }),
);
