import { Module } from '@nestjs/common';
import { EscrowModule } from '../escrow/escrow.module';
import { BankWebhookVerifier } from './bank-webhook-verifier.service';
import { WebhookController } from './webhook.controller';
@Module({
  imports: [EscrowModule],
  controllers: [WebhookController],
  providers: [BankWebhookVerifier],
})
export class WebhookModule {}
