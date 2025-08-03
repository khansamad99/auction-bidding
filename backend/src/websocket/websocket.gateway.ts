import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BidsService } from '../bids/bids.service';
import { AuctionsService } from '../auctions/auctions.service';
import { RedisService } from '../redis/redis.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq-simple.service';
import { WebSocketConnectionLimitService } from '../common/guards/websocket-connection-limit.guard';
import { WebSocketEvents, RabbitMQQueues } from '../common/enums/auction.enum';
import { CreateBidDto } from '../bids/dto/create-bid.dto';
// import { WsThrottlerGuard } from './guards/ws-throttler.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/',
})
// @UseGuards(WsThrottlerGuard)
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebsocketGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly bidsService: BidsService,
    private readonly auctionsService: AuctionsService,
    private readonly redisService: RedisService,
    private readonly rabbitmqService: RabbitmqService,
    private readonly connectionLimitService: WebSocketConnectionLimitService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.setupRedisSubscriptions();
  }

  async handleConnection(socket: Socket) {
    const clientIP = this.getClientIP(socket);
    
    try {
      // 1. Check connection limits BEFORE authentication
      const limitCheck = await this.connectionLimitService.checkConnectionLimit(clientIP);
      
      if (!limitCheck.allowed) {
        this.logger.warn(`Connection rejected from ${clientIP}: ${limitCheck.reason}`);
        socket.disconnect(true);
        return;
      }

      // 2. Authenticate user
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new WsException('No token provided');
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      
      // 3. Check user-specific connection limits
      const userLimitCheck = await this.connectionLimitService.checkConnectionLimit(
        clientIP, 
        userId
      );
      
      if (!userLimitCheck.allowed) {
        this.logger.warn(`Connection rejected for user ${userId}: ${userLimitCheck.reason}`);
        socket.disconnect(true);
        return;
      }

      // 4. Set user data
      socket.data.user = {
        _id: userId,
        username: payload.username,
        email: payload.email,
      };
      socket.data.clientIP = clientIP;

      // 5. Track connections in Redis and local memory
      await this.connectionLimitService.trackConnection(clientIP, socket.id, userId);
      
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      this.logger.log(`User ${payload.username} connected from ${clientIP} (${socket.id})`);
      
      // 6. Send connection confirmation
      socket.emit('connected', {
        message: 'Connected successfully',
        userId,
        username: payload.username,
      });

    } catch (error) {
      this.logger.error(`Connection error from ${clientIP}: ${error.message}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    try {
      // Untrack connection from Redis
      await this.connectionLimitService.untrackConnection(socket.id);
      
      if (socket.data.user) {
        const userId = socket.data.user._id;
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }
        this.logger.log(`User ${socket.data.user.username} disconnected (${socket.id})`);
      } else {
        this.logger.log(`Anonymous connection disconnected (${socket.id})`);
      }
    } catch (error) {
      this.logger.error('Disconnect error:', error.message);
    }
  }

  @SubscribeMessage(WebSocketEvents.JOIN_AUCTION)
  async handleJoinAuction(
    @MessageBody() auctionId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const auction = await this.auctionsService.findOne(auctionId);
      if (!auction) {
        throw new WsException('Auction not found');
      }

      socket.join(`auction:${auctionId}`);
      
      const username = socket.data.user?.username || 'Anonymous';
      this.logger.log(`User ${username} joined auction ${auctionId}`);

      // Subscribe to auction-specific bid updates if not already subscribed
      if (!socket.data.subscribedAuctions) {
        socket.data.subscribedAuctions = new Set();
      }
      
      if (!socket.data.subscribedAuctions.has(auctionId)) {
        await this.redisService.subscribeToAuctionBids(auctionId, (data) => {
          // Broadcast bid update to all clients in the auction room
          this.server.to(`auction:${auctionId}`).emit(WebSocketEvents.BID_UPDATE, {
            auctionId: data.data.auctionId,
            bidId: data.data.bidId,
            userId: data.data.userId,
            bidAmount: data.data.bidAmount,
            timestamp: data.data.timestamp,
            user: data.data.user,
          });
        });

        await this.redisService.subscribeToAuctionEvents(auctionId, (data) => {
          if (data.type === 'AUCTION_ENDED') {
            this.server.to(`auction:${auctionId}`).emit(WebSocketEvents.AUCTION_END, {
              auctionId: data.data.auctionId,
              winningBid: data.data.winningBid,
              message: 'Auction has ended',
            });
          }
        });

        socket.data.subscribedAuctions.add(auctionId);
      }

      // Send current auction state
      socket.emit(WebSocketEvents.AUCTION_UPDATE, {
        auctionId,
        currentHighestBid: auction.currentHighestBid,
        bidCount: auction.bidCount,
        status: auction.status,
      });

      // Notify other users
      if (socket.data.user) {
        socket.to(`auction:${auctionId}`).emit(WebSocketEvents.USER_JOINED, {
          userId: socket.data.user._id,
          username: socket.data.user.username,
        });
      }
    } catch (error) {
      this.logger.error('Join auction error:', error.message);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage(WebSocketEvents.LEAVE_AUCTION)
  async handleLeaveAuction(
    @MessageBody() auctionId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      socket.leave(`auction:${auctionId}`);
      
      if (socket.data.user) {
        this.logger.log(`User ${socket.data.user.username} left auction ${auctionId}`);
        
        // Notify other users
        socket.to(`auction:${auctionId}`).emit(WebSocketEvents.USER_LEFT, {
          userId: socket.data.user._id,
          username: socket.data.user.username,
        });
      } else {
        this.logger.log(`Anonymous user left auction ${auctionId}`);
      }
    } catch (error) {
      this.logger.error('Leave auction error:', error.message);
    }
  }

  @SubscribeMessage(WebSocketEvents.PLACE_BID)
  @UsePipes(new ValidationPipe({ transform: true }))
  async handlePlaceBid(
    @MessageBody() bidData: { auctionId: string; bidAmount: number },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const bidPayload = {
        auctionId: bidData.auctionId,
        userId: socket.data.user._id,
        bidAmount: bidData.bidAmount,
        username: socket.data.user.username,
        socketId: socket.id,
      };

      // Send bid to RabbitMQ for processing
      await this.rabbitmqService.publishBidProcessing(bidPayload);

      // Acknowledge bid received
      socket.emit(WebSocketEvents.BID_RECEIVED, {
        message: 'Bid is being processed',
      });
    } catch (error) {
      this.logger.error('Place bid error:', error.message);
      socket.emit('error', { message: error.message });
    }
  }

  private async setupRedisSubscriptions() {
    try {
      // Subscribe to global notifications
      await this.redisService.subscribeToGlobalNotifications((data) => {
        this.handleGlobalNotification(data);
      });

      this.logger.log('Redis subscriptions set up successfully');
    } catch (error) {
      this.logger.error('Failed to setup Redis subscriptions:', error);
    }
  }


  private handleGlobalNotification(data: any) {
    this.logger.debug('Received global notification:', data);
    // Handle different notification types
    switch (data.data.type) {
      case 'BID_SUCCESS':
      case 'BID_FAILED':
        this.emitToUser(data.data.userId, 'notification', data.data);
        break;
      case 'OUTBID_NOTIFICATION':
        // Emit to all users in the auction except the new highest bidder
        this.emitOutbidNotification(data.data);
        break;
      case 'AUCTION_WON':
        this.emitToUser(data.data.userId, WebSocketEvents.AUCTION_WON, data.data);
        break;
      default:
        this.logger.debug('Unhandled notification type:', data.data.type);
    }
  }

  private emitOutbidNotification(notificationData: any) {
    // Emit to all users in the auction room except the new highest bidder
    this.server.to(`auction:${notificationData.auctionId}`).emit(WebSocketEvents.OUTBID, {
      auctionId: notificationData.auctionId,
      newBidAmount: notificationData.newBidAmount,
      newBidUser: notificationData.newBidUser,
      message: notificationData.message,
    });
  }

  private handleAuctionUpdate(data: any) {
    this.server.to(`auction:${data.auctionId}`).emit(WebSocketEvents.AUCTION_UPDATE, data);
  }

  private handleAuctionEnd(data: any) {
    this.server.to(`auction:${data.auctionId}`).emit(WebSocketEvents.AUCTION_END, {
      auctionId: data.auctionId,
      winnerId: data.winnerId,
      winningBid: data.winningBid,
      message: 'Auction has ended',
    });

    // Send winning notification
    if (data.winnerId) {
      const winnerSockets = this.userSockets.get(data.winnerId);
      if (winnerSockets) {
        winnerSockets.forEach((socketId) => {
          this.server.to(socketId).emit(WebSocketEvents.AUCTION_WON, {
            auctionId: data.auctionId,
            winningBid: data.winningBid,
            message: `Congratulations! You won the auction with a bid of $${data.winningBid}`,
          });
        });
      }
    }
  }

  // Method to emit events from other services
  emitToAuction(auctionId: string, event: string, data: any) {
    this.server.to(`auction:${auctionId}`).emit(event, data);
  }

  // Method to emit to specific user
  emitToUser(userId: string, event: string, data: any) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  // Helper method to get client IP address
  private getClientIP(socket: Socket): string {
    return (
      socket.handshake.headers['x-forwarded-for'] as string ||
      socket.handshake.headers['x-real-ip'] as string ||
      socket.conn.remoteAddress ||
      socket.request.connection?.remoteAddress ||
      'unknown'
    )?.split(',')[0]?.trim() || 'unknown';
  }
}