import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: config.getOrThrow<number>('REDIS_PORT'),
      password: config.get<string>('REDIS_PASSWORD'),
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      commandTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) =>
        attempt > 3 ? null : Math.min(attempt * 200, 1000),
    });
    this.client.on('error', (error) =>
      this.logger.error(`Redis connection error: ${error.message}`),
    );
  }
  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.get(key);
  }
  async acquire(
    key: string,
    token: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    await this.ensureConnected();
    return (await this.client.set(key, token, 'EX', ttlSeconds, 'NX')) === 'OK';
  }
  async release(key: string, token: string): Promise<void> {
    await this.ensureConnected();
    await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token,
    );
  }
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.ensureConnected();
    await this.client.set(key, value, 'EX', ttlSeconds);
  }
  async delete(key: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(key);
  }
  async ping(): Promise<boolean> {
    try {
      await this.ensureConnected();
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end')
      await this.client.quit().catch(() => undefined);
  }
  private async ensureConnected(): Promise<void> {
    try {
      if (this.client.status === 'wait' || this.client.status === 'end')
        await this.client.connect();
    } catch {
      throw new ServiceUnavailableException(
        'Idempotency store is unavailable; mutation was not executed',
      );
    }
  }
}
