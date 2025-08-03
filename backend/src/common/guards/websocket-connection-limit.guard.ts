import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export interface ConnectionLimitOptions {
  maxConnectionsPerIP: number;
  maxConnectionsPerUser: number;
  windowMs: number; // Time window for connection tracking
  blockDuration: number; // How long to block after limit exceeded
}

@Injectable()
export class WebSocketConnectionLimitService {
  private readonly logger = new Logger(WebSocketConnectionLimitService.name);
  private readonly defaultOptions: ConnectionLimitOptions = {
    maxConnectionsPerIP: 5,
    maxConnectionsPerUser: 3,
    windowMs: 60 * 1000, // 1 minute
    blockDuration: 5 * 60 * 1000, // 5 minutes
  };

  constructor(private readonly redisService: RedisService) {}

  async checkConnectionLimit(
    clientIP: string,
    userId?: string,
    options: Partial<ConnectionLimitOptions> = {},
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    const config = { ...this.defaultOptions, ...options };

    try {
      // Check if IP is currently blocked
      const ipBlockKey = `ws-block:ip:${clientIP}`;
      const ipBlocked = await this.redisService.exists(ipBlockKey);
      
      if (ipBlocked) {
        const ttl = await this.redisService.getClient().ttl(ipBlockKey);
        return {
          allowed: false,
          reason: 'IP temporarily blocked due to too many connections',
          retryAfter: ttl > 0 ? ttl : config.blockDuration / 1000,
        };
      }

      // Check if user is currently blocked
      if (userId) {
        const userBlockKey = `ws-block:user:${userId}`;
        const userBlocked = await this.redisService.exists(userBlockKey);
        
        if (userBlocked) {
          const ttl = await this.redisService.getClient().ttl(userBlockKey);
          return {
            allowed: false,
            reason: 'User temporarily blocked due to too many connections',
            retryAfter: ttl > 0 ? ttl : config.blockDuration / 1000,
          };
        }
      }

      // Check current connections for IP
      const ipConnectionKey = `ws-connections:ip:${clientIP}`;
      const ipConnections = await this.redisService.get(ipConnectionKey);
      const currentIPConnections = ipConnections ? parseInt(ipConnections, 10) : 0;

      if (currentIPConnections >= config.maxConnectionsPerIP) {
        // Block the IP for blockDuration
        await this.redisService.set(ipBlockKey, '1', config.blockDuration / 1000);
        
        this.logger.warn(`IP ${clientIP} blocked due to too many connections: ${currentIPConnections}`);
        
        return {
          allowed: false,
          reason: 'Too many connections from this IP address',
          retryAfter: config.blockDuration / 1000,
        };
      }

      // Check current connections for user
      if (userId) {
        const userConnectionKey = `ws-connections:user:${userId}`;
        const userConnections = await this.redisService.get(userConnectionKey);
        const currentUserConnections = userConnections ? parseInt(userConnections, 10) : 0;

        if (currentUserConnections >= config.maxConnectionsPerUser) {
          // Block the user for blockDuration
          const userBlockKey = `ws-block:user:${userId}`;
          await this.redisService.set(userBlockKey, '1', config.blockDuration / 1000);
          
          this.logger.warn(`User ${userId} blocked due to too many connections: ${currentUserConnections}`);
          
          return {
            allowed: false,
            reason: 'Too many connections for this user',
            retryAfter: config.blockDuration / 1000,
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      this.logger.error('Error checking connection limits:', error);
      // Allow connection if there's an error (fail open)
      return { allowed: true };
    }
  }

  async trackConnection(
    clientIP: string,
    socketId: string,
    userId?: string,
    options: Partial<ConnectionLimitOptions> = {},
  ): Promise<void> {
    const config = { ...this.defaultOptions, ...options };

    try {
      // Track IP connection
      const ipConnectionKey = `ws-connections:ip:${clientIP}`;
      const ipSocketKey = `ws-sockets:ip:${clientIP}`;
      
      await this.redisService.sadd(ipSocketKey, socketId);
      const ipCount = await this.redisService.getClient().scard(ipSocketKey);
      await this.redisService.set(ipConnectionKey, ipCount.toString(), config.windowMs / 1000);
      await this.redisService.expire(ipSocketKey, config.windowMs / 1000);

      // Track user connection
      if (userId) {
        const userConnectionKey = `ws-connections:user:${userId}`;
        const userSocketKey = `ws-sockets:user:${userId}`;
        
        await this.redisService.sadd(userSocketKey, socketId);
        const userCount = await this.redisService.getClient().scard(userSocketKey);
        await this.redisService.set(userConnectionKey, userCount.toString(), config.windowMs / 1000);
        await this.redisService.expire(userSocketKey, config.windowMs / 1000);
      }

      // Track individual socket
      const socketInfoKey = `ws-socket:${socketId}`;
      await this.redisService.setJson(socketInfoKey, {
        clientIP,
        userId,
        connectedAt: new Date().toISOString(),
      }, config.windowMs / 1000);

      this.logger.debug(`Connection tracked - IP: ${clientIP}, User: ${userId}, Socket: ${socketId}`);
    } catch (error) {
      this.logger.error('Error tracking connection:', error);
    }
  }

  async untrackConnection(socketId: string): Promise<void> {
    try {
      // Get socket info
      const socketInfoKey = `ws-socket:${socketId}`;
      const socketInfo = await this.redisService.getJson<any>(socketInfoKey);
      
      if (!socketInfo) {
        this.logger.warn(`No socket info found for ${socketId}`);
        return;
      }

      const { clientIP, userId } = socketInfo;

      // Remove from IP tracking
      const ipSocketKey = `ws-sockets:ip:${clientIP}`;
      await this.redisService.srem(ipSocketKey, socketId);
      
      const ipCount = await this.redisService.getClient().scard(ipSocketKey);
      const ipConnectionKey = `ws-connections:ip:${clientIP}`;
      
      if (ipCount > 0) {
        await this.redisService.set(ipConnectionKey, ipCount.toString());
      } else {
        await this.redisService.del(ipConnectionKey);
        await this.redisService.del(ipSocketKey);
      }

      // Remove from user tracking
      if (userId) {
        const userSocketKey = `ws-sockets:user:${userId}`;
        await this.redisService.srem(userSocketKey, socketId);
        
        const userCount = await this.redisService.getClient().scard(userSocketKey);
        const userConnectionKey = `ws-connections:user:${userId}`;
        
        if (userCount > 0) {
          await this.redisService.set(userConnectionKey, userCount.toString());
        } else {
          await this.redisService.del(userConnectionKey);
          await this.redisService.del(userSocketKey);
        }
      }

      // Remove socket info
      await this.redisService.del(socketInfoKey);

      this.logger.debug(`Connection untracked - IP: ${clientIP}, User: ${userId}, Socket: ${socketId}`);
    } catch (error) {
      this.logger.error('Error untracking connection:', error);
    }
  }

  async getConnectionStats(clientIP?: string, userId?: string): Promise<{
    ipConnections?: number;
    userConnections?: number;
    totalConnections: number;
  }> {
    try {
      let ipConnections: number | undefined;
      let userConnections: number | undefined;

      if (clientIP) {
        const ipSocketKey = `ws-sockets:ip:${clientIP}`;
        ipConnections = await this.redisService.getClient().scard(ipSocketKey);
      }

      if (userId) {
        const userSocketKey = `ws-sockets:user:${userId}`;
        userConnections = await this.redisService.getClient().scard(userSocketKey);
      }

      // Get total active connections (approximate)
      const keys = await this.redisService.getClient().keys('ws-socket:*');
      const totalConnections = keys.length;

      return {
        ipConnections,
        userConnections,
        totalConnections,
      };
    } catch (error) {
      this.logger.error('Error getting connection stats:', error);
      return { totalConnections: 0 };
    }
  }

  async isIPBlocked(clientIP: string): Promise<boolean> {
    try {
      const ipBlockKey = `ws-block:ip:${clientIP}`;
      return await this.redisService.exists(ipBlockKey);
    } catch (error) {
      this.logger.error('Error checking if IP is blocked:', error);
      return false;
    }
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const userBlockKey = `ws-block:user:${userId}`;
      return await this.redisService.exists(userBlockKey);
    } catch (error) {
      this.logger.error('Error checking if user is blocked:', error);
      return false;
    }
  }

  async unblockIP(clientIP: string): Promise<void> {
    try {
      const ipBlockKey = `ws-block:ip:${clientIP}`;
      await this.redisService.del(ipBlockKey);
      this.logger.log(`Unblocked IP: ${clientIP}`);
    } catch (error) {
      this.logger.error('Error unblocking IP:', error);
    }
  }

  async unblockUser(userId: string): Promise<void> {
    try {
      const userBlockKey = `ws-block:user:${userId}`;
      await this.redisService.del(userBlockKey);
      this.logger.log(`Unblocked user: ${userId}`);
    } catch (error) {
      this.logger.error('Error unblocking user:', error);
    }
  }
}