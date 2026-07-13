import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection?: amqp.AmqpConnectionManager;
  private channel?: ChannelWrapper;
  private connected = false;
  constructor(private readonly config: ConfigService) {}
  onModuleInit(): void {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      this.logger.warn(
        'RabbitMQ disabled because RABBITMQ_URL is not configured',
      );
      return;
    }
    this.connection = amqp.connect([url]);
    this.channel = this.connection.createChannel({
      json: true,
      setup: (channel: ConfirmChannel) =>
        channel.assertExchange('revorus.escrow.events', 'topic', {
          durable: true,
        }),
    });
    this.connection.on('connect', () => {
      this.connected = true;
      this.logger.log('Connected to RabbitMQ');
    });
    this.connection.on('disconnect', () => {
      this.connected = false;
      this.logger.error('RabbitMQ disconnected');
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
  isHealthy(): boolean {
    return this.connected;
  }
  async publishEvent(
    routingKey: string,
    payload: unknown,
    messageId: string,
  ): Promise<void> {
    if (!this.channel)
      throw new ServiceUnavailableException('RabbitMQ publisher is disabled');
    const timeoutMs = this.config.getOrThrow<number>(
      'RABBITMQ_PUBLISH_TIMEOUT_MS',
    );
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.channel.publish('revorus.escrow.events', routingKey, payload, {
          contentType: 'application/json',
          messageId,
          persistent: true,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('RabbitMQ publish confirmation timed out')),
            timeoutMs,
          );
          timer.unref();
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
