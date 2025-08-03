import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
import { Request } from 'express';

export interface RateLimitOptions {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export const RATE_LIMIT_KEY = 'rate-limit';

export const RateLimit = (options: RateLimitOptions) => {
  return Reflector.createDecorator<RateLimitOptions>()(options);
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get rate limit options from decorator
    const rateLimitOptions = 
      this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, handler) ||
      this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, controller);

    if (!rateLimitOptions) {
      return true; // No rate limiting configured
    }

    const key = this.generateKey(request, rateLimitOptions);
    const windowStart = Math.floor(Date.now() / rateLimitOptions.windowMs) * rateLimitOptions.windowMs;
    const redisKey = `rate-limit:${key}:${windowStart}`;

    try {
      // Get current count
      const currentCount = await this.redisService.get(redisKey);
      const count = currentCount ? parseInt(currentCount, 10) : 0;

      if (count >= rateLimitOptions.maxRequests) {
        this.logger.warn(`Rate limit exceeded for key: ${key}, count: ${count}`);
        throw new HttpException(
          rateLimitOptions.message || 'Too many requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment counter
      const newCount = await this.redisService.incr(redisKey);
      
      // Set expiry on first request of the window
      if (newCount === 1) {
        await this.redisService.expire(redisKey, Math.ceil(rateLimitOptions.windowMs / 1000));
      }

      // Add rate limit headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Limit', rateLimitOptions.maxRequests);
      response.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitOptions.maxRequests - newCount));
      response.setHeader('X-RateLimit-Reset', windowStart + rateLimitOptions.windowMs);

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Rate limiting error:', error);
      return true; // Allow request if rate limiting fails
    }
  }

  private generateKey(request: Request, options: RateLimitOptions): string {
    if (options.keyGenerator) {
      return options.keyGenerator(request);
    }

    // Default key generation: IP + User ID (if authenticated)
    const ip = this.getClientIP(request);
    const userId = (request as any).user?.id || 'anonymous';
    return `${ip}:${userId}`;
  }

  private getClientIP(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }
}

// Specific rate limiting decorators for different use cases
export const APIRateLimit = () => RateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,    // 100 requests per minute
  message: 'Too many API requests, please try again later',
});

export const BidRateLimit = () => RateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,     // 10 bids per minute per user
  message: 'Too many bids, please slow down',
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || 'anonymous';
    return `bid:${userId}`;
  },
});

export const AuthRateLimit = () => RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,           // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for'] as string || 
               req.connection.remoteAddress || 
               'unknown';
    return `auth:${ip.split(',')[0].trim()}`;
  },
});

export const WebSocketRateLimit = () => RateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,      // 5 WebSocket connections per minute per IP
  message: 'Too many WebSocket connections, please try again later',
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for'] as string || 
               req.connection.remoteAddress || 
               'unknown';
    return `ws:${ip.split(',')[0].trim()}`;
  },
});