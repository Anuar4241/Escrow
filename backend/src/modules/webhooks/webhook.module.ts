import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { EscrowModule } from '../escrow/escrow.module';

@Module({
  imports: [EscrowModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
