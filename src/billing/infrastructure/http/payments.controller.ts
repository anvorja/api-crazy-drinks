import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../identity/domain/principal.js';
import {
  Authenticated,
  CurrentPrincipal,
} from '../../../identity/infrastructure/http/auth.decorators.js';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiErrors,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import {
  ListMyPayments,
  StartCheckout,
  VerifyPayment,
} from '../../application/use-cases/payments.js';
import type {
  CheckoutBodyDto,
  VerifyPaymentBodyDto,
} from './dto/payments.dto.js';
import {
  checkoutBodySchema,
  checkoutResponseSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
  toPaymentResponse,
  verifyPaymentBodySchema,
} from './dto/payments.dto.js';

@ApiTags('Plans & subscriptions')
@ApiBearer()
@Authenticated()
@Controller('me')
export class PaymentsController {
  constructor(
    private readonly startCheckout: StartCheckout,
    private readonly verifyPayment: VerifyPayment,
    private readonly listMyPayments: ListMyPayments,
  ) {}

  @Post('subscription/checkout')
  @ApiOperation({
    summary: 'Pay for a plan',
    description:
      'Creates a pending payment and returns the payment provider checkout (Wompi). When it is approved the plan becomes active for SUBSCRIPTION_PERIOD_DAYS; paying the same plan again extends it. 503 PAYMENTS_UNAVAILABLE if payments are not configured.',
  })
  @ApiBodyFrom(checkoutBodySchema)
  @ApiResponseFrom(
    201,
    checkoutResponseSchema,
    'Pending payment and checkout URL',
  )
  @ApiErrors(400, 404, 503)
  async checkout(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(checkoutBodySchema)) body: CheckoutBodyDto,
  ) {
    const { payment, checkoutUrl } = await this.startCheckout.execute(
      me,
      body.planId,
    );
    return { payment: toPaymentResponse(payment), checkoutUrl };
  }

  @Post('payments/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a payment on return',
    description:
      'Call it with the ?id=… the checkout adds when it comes back to your page: the API asks the provider and settles the payment right away (the webhook does the same, whichever arrives first; it never applies twice).',
  })
  @ApiBodyFrom(verifyPaymentBodySchema)
  @ApiResponseFrom(200, paymentResponseSchema, 'The payment, settled')
  @ApiErrors(400, 403, 404, 503)
  async verify(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(verifyPaymentBodySchema))
    body: VerifyPaymentBodyDto,
  ) {
    return toPaymentResponse(
      await this.verifyPayment.execute(me, body.transactionId),
    );
  }

  @Get('payments')
  @ApiOperation({ summary: 'My payments', description: 'Newest first.' })
  @ApiResponseFrom(200, paymentListResponseSchema, 'Payments')
  async list(@CurrentPrincipal() me: Principal) {
    return (await this.listMyPayments.execute(me)).map(toPaymentResponse);
  }
}
