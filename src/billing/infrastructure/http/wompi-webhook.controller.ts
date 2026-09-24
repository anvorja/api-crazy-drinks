import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UnauthorizedError,
  UnavailableError,
} from '../../../shared/domain/errors.js';
import {
  ApiErrors,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ApplyPaymentOutcome } from '../../application/use-cases/payments.js';
import { WOMPI_GATEWAY } from '../tokens.js';
import type { WompiGateway } from '../wompi/wompi.gateway.js';

/**
 * Wompi events (https://docs.wompi.co/docs/colombia/eventos/). Public: trust comes from the
 * checksum, not from credentials. Answers 200 for every valid event (Wompi retries otherwise).
 */
@ApiTags('Webhooks')
@Controller('webhooks/wompi')
export class WompiWebhookController {
  constructor(
    @Inject(WOMPI_GATEWAY) private readonly wompi: WompiGateway | null,
    private readonly applyPaymentOutcome: ApplyPaymentOutcome,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Wompi events',
    description:
      'Configure this URL as the events URL in the Wompi dashboard. Verifies the SHA256 checksum with WOMPI_EVENTS_SECRET; transaction.updated settles the payment and, if approved, activates the plan.',
  })
  @ApiBody({
    description: 'Event as Wompi sends it',
    schema: { type: 'object' },
  })
  @ApiResponseFrom(200, null, 'Event received')
  @ApiErrors(401, 503)
  async receive(@Body() event: unknown) {
    if (!this.wompi)
      throw new UnavailableError(
        'Payments are not configured',
        'PAYMENTS_UNAVAILABLE',
      );
    const { valid, outcome } = this.wompi.verifyEvent(event);
    if (!valid)
      throw new UnauthorizedError(
        'Invalid event checksum',
        'INVALID_WEBHOOK_SIGNATURE',
      );
    if (outcome) await this.applyPaymentOutcome.execute(outcome);
  }
}
