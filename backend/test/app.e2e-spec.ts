import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { RabbitMQService } from '../src/infrastructure/messaging/rabbitmq.service';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
describe('application boundaries (e2e)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn().mockResolvedValue([1]) })
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue(true) })
      .overrideProvider(RabbitMQService)
      .useValue({ isHealthy: jest.fn().mockReturnValue(true) })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  it('exposes liveness', () =>
    request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' }));
  it('protects escrow routes', () =>
    request(app.getHttpServer()).get('/escrows').expect(401));
});
