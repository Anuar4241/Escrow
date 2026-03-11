import { Controller, Post, Body, Headers, HttpCode, HttpStatus, UnauthorizedException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EscrowService } from '../escrow/escrow.service';

@ApiTags('External Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly escrowService: EscrowService) {}

  @Post('payment/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive async payment status from Stripe/PSP' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Body() payload: any,
  ) {
    // 1. Verify Signature (Simulated)
    if (!signature) {
      throw new UnauthorizedException('Missing provider signature');
    }

    this.logger.log(`Received Webhook: ${payload?.type}`);

    // 2. Idempotent processing based on event type
    try {
      if (payload.type === 'charge.succeeded') {
        const providerTxId = payload.data.object.id;
        const escrowId = payload.data.object.metadata.escrowId;
        const dealVersion = parseInt(payload.data.object.metadata.dealVersion, 10);
        
        // This delegates back to the strict state machine engine
        await this.escrowService.fundEscrow(escrowId, dealVersion, providerTxId);
        this.logger.log(`Escrow ${escrowId} successfully funded via Webhook`);
      }

      // Ignore unhandled events by returning 200 OK so PSP doesn't retry them
      return { received: true };

    } catch (error) {
      // Return 400 for structural invalidity so PSP handles it
      // However if it's a CONFLICT/RACE condition, PSP will retry cleanly later
      this.logger.error('Webhook processing failed', error);
      throw error;
    }
  }
}
