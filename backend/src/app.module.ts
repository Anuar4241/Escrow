import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment';
import { IdempotencyModule } from './infrastructure/idempotency/idempotency.module';
import { RabbitMQModule } from './infrastructure/messaging/rabbitmq.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { HealthModule } from './modules/health/health.module';
import { WebhookModule } from './modules/webhooks/webhook.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    PrismaModule,
    RedisModule,
    RabbitMQModule,
    OutboxModule,
    IdempotencyModule,
    EscrowModule,
    WebhookModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
