import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../identity/domain/principal.js';
import {
  Authenticated,
  CurrentPrincipal,
  Roles,
} from '../../../identity/infrastructure/http/auth.decorators.js';
import { userIdSchema } from '../../../identity/infrastructure/http/dto/auth-requests.dto.js';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiErrors,
  ApiParamFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import {
  CancelMySubscription,
  GetEffectivePlan,
  ListPlans,
  SetSubscription,
} from '../../application/use-cases/billing.js';
import type { SetSubscriptionBodyDto } from './dto/billing.dto.js';
import {
  planListResponseSchema,
  planStatusResponseSchema,
  setSubscriptionBodySchema,
  subscriptionResponseSchema,
  toPlanResponse,
  toPlanStatusResponse,
  toSubscriptionResponse,
} from './dto/billing.dto.js';

@ApiTags('Plans & subscriptions')
@Controller()
export class BillingController {
  constructor(
    private readonly listPlans: ListPlans,
    private readonly getEffectivePlan: GetEffectivePlan,
    private readonly cancelMySubscription: CancelMySubscription,
    private readonly setSubscription: SetSubscription,
  ) {}

  @Get('plans')
  @ApiOperation({
    summary: 'Available plans',
    description:
      'Limits for venues, inventory, menu pricing and API usage. Public.',
  })
  @ApiResponseFrom(200, planListResponseSchema, 'Plans, cheapest first')
  async plans() {
    return (await this.listPlans.execute()).map(toPlanResponse);
  }

  @Get('me/subscription')
  @Authenticated()
  @ApiBearer()
  @ApiOperation({
    summary: 'My plan',
    description:
      'The plan in effect (free without an active subscription) and the subscription, if any.',
  })
  @ApiResponseFrom(200, planStatusResponseSchema, 'Plan status')
  async mine(@CurrentPrincipal() me: Principal) {
    return toPlanStatusResponse(await this.getEffectivePlan.execute(me.userId));
  }

  @Post('me/subscription/cancel')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  @ApiBearer()
  @ApiOperation({
    summary: 'Cancel my subscription',
    description:
      'Stops renewal. The plan keeps working until the current period ends.',
  })
  @ApiResponseFrom(200, subscriptionResponseSchema, 'Canceled subscription')
  @ApiErrors(404)
  async cancel(@CurrentPrincipal() me: Principal) {
    return toSubscriptionResponse(await this.cancelMySubscription.execute(me));
  }

  @Put('admin/users/:id/subscription')
  @Roles('admin')
  @ApiTags('Admin')
  @ApiBearer()
  @ApiOperation({
    summary: "Set a user's subscription",
    description:
      'Admin-operated until a payment gateway is connected (e.g. after confirming a transfer).',
  })
  @ApiParamFrom('id', userIdSchema, 'User id')
  @ApiBodyFrom(setSubscriptionBodySchema)
  @ApiResponseFrom(200, subscriptionResponseSchema, 'The subscription')
  @ApiErrors(400, 403, 404)
  async set(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ZodValidationPipe(userIdSchema)) userId: string,
    @Body(new ZodValidationPipe(setSubscriptionBodySchema))
    body: SetSubscriptionBodyDto,
  ) {
    return toSubscriptionResponse(
      await this.setSubscription.execute(actor, { userId, ...body }),
    );
  }
}
