import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { hostname } from 'os';
import { RabbitMQService } from '../messaging/rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';
interface OutboxMessage {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
}
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly workerId = `${hostname()}:${process.pid}`;
  private timer?: NodeJS.Timeout;
  private draining = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMQService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit(): void {
    if (this.config.get<boolean>('OUTBOX_PUBLISHER_ENABLED')) {
      this.timer = setInterval(
        () => void this.drain(),
        this.config.getOrThrow<number>('OUTBOX_POLL_INTERVAL_MS'),
      );
      this.timer.unref();
    }
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  async enqueue(
    transaction: Prisma.TransactionClient,
    message: OutboxMessage,
  ): Promise<void> {
    await transaction.outboxEvent.create({ data: message });
  }
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const now = new Date();
      const staleLock = new Date(now.getTime() - 60_000);
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED', 'PROCESSING'] },
          availableAt: { lte: now },
          OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }],
        },
        orderBy: { createdAt: 'asc' },
        take: 25,
      });
      for (const event of events) {
        const claimed = await this.prisma.outboxEvent.updateMany({
          where: {
            id: event.id,
            status: { in: ['PENDING', 'FAILED', 'PROCESSING'] },
            OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }],
          },
          data: {
            status: 'PROCESSING',
            lockedAt: now,
            lockedBy: this.workerId,
            attempts: { increment: 1 },
          },
        });
        if (claimed.count !== 1) continue;
        try {
          await this.rabbit.publishEvent(
            event.eventType,
            {
              eventId: event.id,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              eventType: event.eventType,
              createdAt: event.createdAt.toISOString(),
              payload: event.payload,
            },
            event.id,
          );
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              lastError: null,
            },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const backoffSeconds = Math.min(
            300,
            2 ** Math.min(event.attempts + 1, 8),
          );
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'FAILED',
              availableAt: new Date(Date.now() + backoffSeconds * 1000),
              lockedAt: null,
              lockedBy: null,
              lastError: message.slice(0, 2000),
            },
          });
          this.logger.error(`Outbox ${event.id} failed: ${message}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Outbox drain failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.draining = false;
    }
  }
}
