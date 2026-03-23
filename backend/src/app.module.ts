import { Module } from '@nestjs/common';
import { EscrowModule } from './modules/escrow/escrow.module';
import { WebhookModule } from './modules/webhooks/webhook.module';
import { RabbitMQModule } from './infrastructure/messaging/rabbitmq.module';
import { AgentsModule } from './modules/agents/agents.module';

@Module({
  imports: [RabbitMQModule, EscrowModule, WebhookModule, AgentsModule],
})
export class AppModule {}
