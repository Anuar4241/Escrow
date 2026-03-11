import { Module } from '@nestjs/common';
import { EscrowModule } from './modules/escrow/escrow.module';
import { WebhookModule } from './modules/webhooks/webhook.module';
import { RabbitMQModule } from './infrastructure/messaging/rabbitmq.module';

@Module({
  imports: [RabbitMQModule, EscrowModule, WebhookModule],
})
export class AppModule {}
