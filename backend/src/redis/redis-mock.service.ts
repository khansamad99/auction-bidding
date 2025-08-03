import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  async onModuleInit() {
    this.logger.log('Redis Mock Service initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Redis Mock Service destroyed');  
  }

  // Basic operations
  async get(key: string): Promise<string | null> {
    return null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.logger.debug(`Mock: SET ${key} = ${value}`);
  }

  async del(key: string): Promise<void> {
    this.logger.debug(`Mock: DEL ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    return false;
  }

  async publish(channel: string, message: string): Promise<void> {
    this.logger.debug(`Mock: PUBLISH ${channel} ${message}`);
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    this.logger.debug(`Mock: SUBSCRIBE ${channel}`);
  }

  async acquireLock(key: string, ttl = 5000): Promise<boolean> {
    this.logger.debug(`Mock: Acquiring lock ${key}`);
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.logger.debug(`Mock: Releasing lock ${key}`);
  }

  async cacheAuction(auctionId: string, auction: any, ttl = 300): Promise<void> {
    this.logger.debug(`Mock: Caching auction ${auctionId}`);
  }

  async getCachedAuction(auctionId: string): Promise<any> {
    return null;
  }

  async cacheHighestBid(auctionId: string, bid: any, ttl = 60): Promise<void> {
    this.logger.debug(`Mock: Caching highest bid for auction ${auctionId}`);
  }

  async getCachedHighestBid(auctionId: string): Promise<any> {
    return null;
  }
}