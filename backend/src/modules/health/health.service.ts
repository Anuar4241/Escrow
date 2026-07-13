import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '../../infrastructure/messaging/rabbitmq.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbit: RabbitMQService,
    private readonly config: ConfigService,
  ) {}
  async readiness() {
    let database = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    const redis = await this.redis.ping();
    const rabbitmq =
      !this.config.get<boolean>('OUTBOX_PUBLISHER_ENABLED') ||
      this.rabbit.isHealthy();
    return {
      status: database && redis && rabbitmq ? 'ok' : 'unavailable',
      checks: { database, redis, rabbitmq },
    };
  }
}
