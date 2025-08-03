import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RabbitmqService {
  private readonly logger = new Logger(RabbitmqService.name);

  async onModuleInit() {
    this.logger.log('RabbitMQ Mock Service initialized');
  }

  async onModuleDestroy() {
    this.logger.log('RabbitMQ Mock Service destroyed');
  }

  async publishToQueue(queue: string, message: any): Promise<void> {
    this.logger.debug(`Mock: Publishing to queue ${queue}`, message);
  }

  async publishBidProcessing(bid: any): Promise<void> {
    this.logger.debug('Mock: Publishing bid processing', bid);
  }

  async publishNotification(notification: any): Promise<void> {
    this.logger.debug('Mock: Publishing notification', notification);
  }

  async publishAuditLog(log: any): Promise<void> {
    this.logger.debug('Mock: Publishing audit log', log);
  }

  async consumeFromQueue(queue: string, handler: (message: any) => Promise<void>): Promise<void> {
    this.logger.debug(`Mock: Setting up consumer for queue ${queue}`);
  }
}