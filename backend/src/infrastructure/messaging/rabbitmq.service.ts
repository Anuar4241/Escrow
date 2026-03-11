import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  async onModuleInit() {
    this.connection = amqp.connect([process.env.RABBITMQ_URL || 'amqp://root:rootpassword@localhost:5672']);
    
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: function(channel: ConfirmChannel) {
        // Assert the central domain exchange
        return Promise.all([
          channel.assertExchange('revorus.escrow.events', 'topic', { durable: true }),
        ]);
      },
    });

    this.connection.on('connect', () => this.logger.log('Connected to RabbitMQ!'));
    this.connection.on('disconnect', err => this.logger.error('RabbitMQ Disconnected.', err));
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }

  /**
   * Publish a high-value domain event.
   * e.g., deal.funded, deal.shipped, deal.disputed
   */
  async publishEvent(routingKey: string, payload: any) {
    try {
      await this.channelWrapper.publish('revorus.escrow.events', routingKey, payload);
      this.logger.debug(`Published event ${routingKey}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${routingKey}`, error);
      throw error;
    }
  }
}
