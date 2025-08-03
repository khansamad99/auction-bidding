import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis;
  private subscriberClient: Redis;
  private publisherClient: Redis;
  private subscribers = new Map<string, (message: string) => void>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      const redisConfig = {
        host: this.configService.get<string>('redis.host', 'localhost'),
        port: this.configService.get<number>('redis.port', 6379),
        password: this.configService.get<string>('redis.password'),
        db: this.configService.get<number>('redis.db', 0),
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
      };

      this.redisClient = new Redis(redisConfig);
      this.subscriberClient = new Redis(redisConfig);
      this.publisherClient = new Redis(redisConfig);

      // Wait for connections to be established
      await this.redisClient.connect();
      await this.subscriberClient.connect();
      await this.publisherClient.connect();

      this.redisClient.on('connect', () => {
        this.logger.log('Redis client connected');
      });

      this.redisClient.on('error', (error) => {
        this.logger.error('Redis client error:', error);
      });

      this.subscriberClient.on('message', (channel, message) => {
        this.logger.debug(`Received message on channel ${channel}: ${message}`);
        const handler = this.subscribers.get(channel);
        if (handler) {
          try {
            handler(message);
          } catch (error) {
            this.logger.error(`Error handling message on channel ${channel}:`, error);
          }
        }
      });

      this.logger.log('Redis service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Redis service:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
    await this.subscriberClient.quit();
    await this.publisherClient.quit();
  }

  // Key-Value Operations
  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redisClient.setex(key, ttl, value);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redisClient.exists(key)) === 1;
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.redisClient.expire(key, ttl);
  }

  // Hash Operations
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redisClient.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redisClient.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redisClient.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.redisClient.hdel(key, field);
  }

  // List Operations
  async lpush(key: string, value: string): Promise<void> {
    await this.redisClient.lpush(key, value);
  }

  async rpush(key: string, value: string): Promise<void> {
    await this.redisClient.rpush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    return this.redisClient.lpop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redisClient.lrange(key, start, stop);
  }

  // Set Operations
  async sadd(key: string, member: string): Promise<void> {
    await this.redisClient.sadd(key, member);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.redisClient.srem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redisClient.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.redisClient.sismember(key, member)) === 1;
  }

  // Sorted Set Operations
  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.redisClient.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redisClient.zrange(key, start, stop);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redisClient.zrevrange(key, start, stop);
  }

  // Pub/Sub Operations
  async publish(channel: string, message: string): Promise<void> {
    await this.publisherClient.publish(channel, message);
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    if (!this.subscriberClient) {
      this.logger.warn('Redis subscriber client not initialized, skipping subscription');
      return;
    }
    this.subscribers.set(channel, handler);
    await this.subscriberClient.subscribe(channel);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.subscribers.delete(channel);
    await this.subscriberClient.unsubscribe(channel);
  }

  // Atomic Operations
  async incr(key: string): Promise<number> {
    return this.redisClient.incr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.redisClient.incrby(key, increment);
  }

  async decr(key: string): Promise<number> {
    return this.redisClient.decr(key);
  }

  async decrby(key: string, decrement: number): Promise<number> {
    return this.redisClient.decrby(key, decrement);
  }

  // Cache Operations with JSON
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  async setJson<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  // Auction-specific cache operations
  async cacheAuction(auctionId: string, auction: any, ttl = 300): Promise<void> {
    await this.setJson(`auction:${auctionId}`, auction, ttl);
  }

  async getCachedAuction(auctionId: string): Promise<any> {
    return this.getJson(`auction:${auctionId}`);
  }

  async invalidateAuctionCache(auctionId: string): Promise<void> {
    await this.del(`auction:${auctionId}`);
  }

  async cacheHighestBid(auctionId: string, bid: any, ttl = 60): Promise<void> {
    await this.setJson(`auction:${auctionId}:highest-bid`, bid, ttl);
  }

  async getCachedHighestBid(auctionId: string): Promise<any> {
    return this.getJson(`auction:${auctionId}:highest-bid`);
  }

  // Distributed locking
  async acquireLock(key: string, ttl = 5000): Promise<boolean> {
    const result = await this.redisClient.set(
      `lock:${key}`,
      '1',
      'PX',
      ttl,
      'NX',
    );
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(`lock:${key}`);
  }

  // Auction-specific Pub/Sub channels
  getAuctionBidChannel(auctionId: string): string {
    return `auction:${auctionId}:bids`;
  }

  getAuctionEventsChannel(auctionId: string): string {
    return `auction:${auctionId}:events`;
  }

  getGlobalNotificationsChannel(): string {
    return 'global:notifications';
  }

  // Publish auction events
  async publishBidUpdate(auctionId: string, bidData: any): Promise<void> {
    const channel = this.getAuctionBidChannel(auctionId);
    const message = JSON.stringify({
      type: 'BID_UPDATE',
      auctionId,
      timestamp: new Date().toISOString(),
      data: bidData
    });
    await this.publish(channel, message);
    this.logger.debug(`Published bid update to channel ${channel}`);
  }

  async publishAuctionEvent(auctionId: string, eventType: string, eventData: any): Promise<void> {
    const channel = this.getAuctionEventsChannel(auctionId);
    const message = JSON.stringify({
      type: eventType,
      auctionId,
      timestamp: new Date().toISOString(),
      data: eventData
    });
    await this.publish(channel, message);
    this.logger.debug(`Published auction event ${eventType} to channel ${channel}`);
  }

  async publishGlobalNotification(notification: any): Promise<void> {
    const channel = this.getGlobalNotificationsChannel();
    const message = JSON.stringify({
      type: 'GLOBAL_NOTIFICATION',
      timestamp: new Date().toISOString(),
      data: notification
    });
    await this.publish(channel, message);
    this.logger.debug(`Published global notification to channel ${channel}`);
  }

  // Subscribe to auction events
  async subscribeToAuctionBids(auctionId: string, handler: (data: any) => void): Promise<void> {
    const channel = this.getAuctionBidChannel(auctionId);
    await this.subscribe(channel, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        handler(parsedMessage);
      } catch (error) {
        this.logger.error(`Error parsing message from channel ${channel}:`, error);
      }
    });
  }

  async subscribeToAuctionEvents(auctionId: string, handler: (data: any) => void): Promise<void> {
    const channel = this.getAuctionEventsChannel(auctionId);
    await this.subscribe(channel, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        handler(parsedMessage);
      } catch (error) {
        this.logger.error(`Error parsing message from channel ${channel}:`, error);
      }
    });
  }

  async subscribeToGlobalNotifications(handler: (data: any) => void): Promise<void> {
    const channel = this.getGlobalNotificationsChannel();
    await this.subscribe(channel, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        handler(parsedMessage);
      } catch (error) {
        this.logger.error(`Error parsing message from channel ${channel}:`, error);
      }
    });
  }

  // Unsubscribe from auction events
  async unsubscribeFromAuctionBids(auctionId: string): Promise<void> {
    const channel = this.getAuctionBidChannel(auctionId);
    await this.unsubscribe(channel);
  }

  async unsubscribeFromAuctionEvents(auctionId: string): Promise<void> {
    const channel = this.getAuctionEventsChannel(auctionId);
    await this.unsubscribe(channel);
  }

  async unsubscribeFromGlobalNotifications(): Promise<void> {
    const channel = this.getGlobalNotificationsChannel();
    await this.unsubscribe(channel);
  }

  // Connection health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.redisClient.ping();
      return true;
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  // Get the Redis client for advanced operations
  getClient() {
    return this.redisClient;
  }
}