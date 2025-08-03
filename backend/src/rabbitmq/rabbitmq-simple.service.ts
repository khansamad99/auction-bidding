import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum RabbitMQQueues {
  BID_PROCESSING = 'bid-processing',
  NOTIFICATIONS = 'notifications',
  AUDIT_LOGS = 'audit-logs',
  DEAD_LETTER = 'dead-letter'
}

export enum RabbitMQExchanges {
  AUCTION_EVENTS = 'auction-events',
  NOTIFICATIONS = 'notifications',
  AUDIT = 'audit'
}

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: any;
  private channel: any;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      // Import amqplib dynamically to avoid type issues
      const amqp = await import('amqplib');
      
      const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
      
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      // Setup exchanges and queues
      await this.setupQueuesAndExchanges();
      
      this.logger.log('RabbitMQ Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ service:', error);
      // Don't throw error to allow app to start without RabbitMQ
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection:', error);
    }
  }

  private async setupQueuesAndExchanges(): Promise<void> {
    if (!this.channel) return;
    
    try {
      // Create exchanges
      await this.channel.assertExchange(RabbitMQExchanges.AUCTION_EVENTS, 'topic', { durable: true });
      await this.channel.assertExchange(RabbitMQExchanges.NOTIFICATIONS, 'direct', { durable: true });
      await this.channel.assertExchange(RabbitMQExchanges.AUDIT, 'direct', { durable: true });

      // Create dead letter exchange and queue
      await this.channel.assertExchange('dead-letter-exchange', 'direct', { durable: true });
      await this.channel.assertQueue(RabbitMQQueues.DEAD_LETTER, { durable: true });
      await this.channel.bindQueue(RabbitMQQueues.DEAD_LETTER, 'dead-letter-exchange', 'dead-letter');

      // Create main queues
      const queueOptions = {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dead-letter-exchange',
          'x-dead-letter-routing-key': 'dead-letter',
          'x-message-ttl': 300000,
        },
      };

      await this.channel.assertQueue(RabbitMQQueues.BID_PROCESSING, queueOptions);
      await this.channel.bindQueue(RabbitMQQueues.BID_PROCESSING, RabbitMQExchanges.AUCTION_EVENTS, 'bid.placed');

      await this.channel.assertQueue(RabbitMQQueues.NOTIFICATIONS, queueOptions);
      await this.channel.bindQueue(RabbitMQQueues.NOTIFICATIONS, RabbitMQExchanges.NOTIFICATIONS, 'notification');

      await this.channel.assertQueue(RabbitMQQueues.AUDIT_LOGS, queueOptions);
      await this.channel.bindQueue(RabbitMQQueues.AUDIT_LOGS, RabbitMQExchanges.AUDIT, 'audit');

      await this.channel.prefetch(10);

      this.logger.log('RabbitMQ queues and exchanges set up successfully');
    } catch (error) {
      this.logger.error('Failed to setup RabbitMQ queues and exchanges:', error);
    }
  }

  async publishToQueue(queue: string, message: any): Promise<void> {
    try {
      if (!this.channel) {
        this.logger.warn('RabbitMQ channel not available, skipping message');
        return;
      }

      const buffer = Buffer.from(JSON.stringify(message));
      this.channel.sendToQueue(queue, buffer, { persistent: true });
      this.logger.debug(`Message published to queue ${queue}`);
    } catch (error) {
      this.logger.error(`Failed to publish to queue ${queue}:`, error);
    }
  }

  async publishToExchange(exchange: string, routingKey: string, message: any): Promise<void> {
    try {
      if (!this.channel) {
        this.logger.warn('RabbitMQ channel not available, skipping message');
        return;
      }

      const buffer = Buffer.from(JSON.stringify(message));
      this.channel.publish(exchange, routingKey, buffer, { persistent: true });
      this.logger.debug(`Message published to exchange ${exchange}`);
    } catch (error) {
      this.logger.error(`Failed to publish to exchange ${exchange}:`, error);
    }
  }

  async publishBidProcessing(bid: any): Promise<void> {
    await this.publishToExchange(RabbitMQExchanges.AUCTION_EVENTS, 'bid.placed', {
      ...bid,
      eventType: 'BID_PLACED',
      timestamp: new Date().toISOString(),
    });
  }

  async publishNotification(notification: any): Promise<void> {
    await this.publishToExchange(RabbitMQExchanges.NOTIFICATIONS, 'notification', {
      ...notification,
      eventType: 'NOTIFICATION',
      timestamp: new Date().toISOString(),
    });
  }

  async publishAuditLog(log: any): Promise<void> {
    await this.publishToExchange(RabbitMQExchanges.AUDIT, 'audit', {
      ...log,
      eventType: 'AUDIT_LOG',
      timestamp: new Date().toISOString(),
    });
  }

  async startBidProcessingConsumer(handler: (bid: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel not available, skipping consumer setup');
      return;
    }

    try {
      await this.channel.consume(RabbitMQQueues.BID_PROCESSING, async (msg: any) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await handler(content);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error('Error processing bid message:', error);
            this.channel.nack(msg, false, false);
          }
        }
      });

      this.logger.log('Bid processing consumer started');
    } catch (error) {
      this.logger.error('Failed to start bid processing consumer:', error);
    }
  }

  async startNotificationConsumer(handler: (notification: any) => Promise<void>): Promise<void> {
    if (!this.channel) return;

    try {
      await this.channel.consume(RabbitMQQueues.NOTIFICATIONS, async (msg: any) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await handler(content);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error('Error processing notification:', error);
            this.channel.nack(msg, false, false);
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to start notification consumer:', error);
    }
  }

  async startAuditConsumer(handler: (log: any) => Promise<void>): Promise<void> {
    if (!this.channel) return;

    try {
      await this.channel.consume(RabbitMQQueues.AUDIT_LOGS, async (msg: any) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await handler(content);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error('Error processing audit log:', error);
            this.channel.nack(msg, false, false);
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to start audit consumer:', error);
    }
  }

  isConnected(): boolean {
    return !!this.connection && !!this.channel;
  }
}