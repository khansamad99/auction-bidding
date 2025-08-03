import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RabbitmqService } from '../rabbitmq/rabbitmq-simple.service';
import { RedisService } from '../redis/redis.service';
import { Bid } from '../database/schemas/bid.schema';
import { Auction } from '../database/schemas/auction.schema';
import { User } from '../database/schemas/user.schema';
import { RabbitMQQueues, BidStatus, AuctionStatus } from '../common/enums/auction.enum';

@Injectable()
export class BidProcessorService implements OnModuleInit {
  private readonly logger = new Logger(BidProcessorService.name);

  constructor(
    @InjectModel(Bid.name) private bidModel: Model<Bid>,
    @InjectModel(Auction.name) private auctionModel: Model<Auction>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly rabbitmqService: RabbitmqService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Start consuming bid processing messages from RabbitMQ
    await this.rabbitmqService.startBidProcessingConsumer(this.processBid.bind(this));
    this.logger.log('Bid processor service initialized and consuming messages');
  }

  private async processBid(bidData: any) {
    const { auctionId, userId, bidAmount, username, socketId } = bidData;
    const lockKey = `bid-processing:${auctionId}`;

    try {
      // Acquire distributed lock for this auction
      const lockAcquired = await this.redisService.acquireLock(lockKey, 10000);
      if (!lockAcquired) {
        throw new Error('Could not acquire lock for bid processing');
      }

      // Simplified version without transactions for development
      // 1. Get current auction state
      const auction = await this.auctionModel.findById(auctionId);
      
      if (!auction) {
        throw new Error('Auction not found');
      }

      // 2. Validate auction state
      const now = new Date();
      if (auction.status !== AuctionStatus.ACTIVE) {
        throw new Error('Auction is not active');
      }

      if (now < auction.startTime) {
        throw new Error('Auction has not started yet');
      }

      if (now > auction.endTime) {
        throw new Error('Auction has ended');
      }

      // 3. Validate bid amount
      const minBidAmount = (auction.currentHighestBid || auction.startingBid) + 100;
      if (bidAmount < minBidAmount) {
        throw new Error(`Bid must be at least $${minBidAmount}`);
      }

      // 4. Get user information
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // 5. Create the bid
      const newBid = new this.bidModel({
        userId,
        auctionId,
        bidAmount,
        timestamp: now,
        isWinning: true,
        status: BidStatus.ACCEPTED,
      });

      await newBid.save();

      // 6. Mark previous winning bids as no longer winning
      await this.bidModel.updateMany(
        { auctionId, isWinning: true, _id: { $ne: newBid._id } },
        { isWinning: false, status: BidStatus.OUTBID }
      );

      // 7. Update auction with new highest bid using atomic operation
      const updatedAuction = await this.auctionModel.findByIdAndUpdate(
        auctionId,
        {
          $set: {
            currentHighestBid: bidAmount,
            winnerId: userId,
          },
          $inc: {
            bidCount: 1,
          },
        },
        { 
          new: true, 
          runValidators: true 
        }
      );

      if (!updatedAuction) {
        throw new Error('Failed to update auction');
      }

      // Store processed bid with user info
      const processedBid = {
        ...newBid.toObject(),
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
        }
      };

      // 8. Post-processing after successful transaction
      await this.handleSuccessfulBid(processedBid, updatedAuction);

      this.logger.log(`Bid processed successfully: ${processedBid._id} for auction ${auctionId}`);
      
    } catch (error) {
      this.logger.error(`Failed to process bid for auction ${auctionId}: ${error.message}`);

      // Send failure notifications
      await this.handleFailedBid(bidData, error.message);
      
      throw error;
    } finally {
      // Always release lock
      await this.redisService.releaseLock(lockKey);
    }
  }

  private async handleSuccessfulBid(bid: any, auction: any): Promise<void> {
    try {
      const { auctionId, userId, bidAmount, timestamp, user } = bid;

      // 1. Update Redis cache
      await this.redisService.cacheHighestBid(auctionId.toString(), {
        bidId: bid._id,
        userId,
        bidAmount,
        timestamp,
        user,
      });

      await this.redisService.cacheAuction(auctionId.toString(), auction);

      // 2. Publish to Redis Pub/Sub for real-time updates
      await this.redisService.publishBidUpdate(auctionId.toString(), {
        bidId: bid._id,
        userId,
        auctionId,
        bidAmount,
        timestamp,
        user,
        auctionTitle: auction.title,
      });

      // 3. Send success notification
      await this.rabbitmqService.publishNotification({
        type: 'BID_SUCCESS',
        userId,
        auctionId,
        message: `Your bid of $${bidAmount.toLocaleString()} has been placed successfully on "${auction.title}"`,
        data: {
          bidId: bid._id,
          bidAmount,
          auctionTitle: auction.title,
        }
      });

      // 4. Send outbid notifications to previous bidders
      await this.rabbitmqService.publishNotification({
        type: 'OUTBID_NOTIFICATION',
        auctionId,
        excludeUserId: userId, // Don't notify the new highest bidder
        message: `You have been outbid on "${auction.title}". New highest bid: $${bidAmount.toLocaleString()}`,
        data: {
          newBidAmount: bidAmount,
          newBidUser: user,
          auctionTitle: auction.title,
        }
      });

      // 5. Publish audit log
      await this.rabbitmqService.publishAuditLog({
        action: 'BID_PLACED',
        auctionId,
        userId,
        success: true,
        details: {
          bidId: bid._id,
          bidAmount,
          previousBid: auction.currentHighestBid - 100, // Approximate
          auctionTitle: auction.title,
          timestamp: timestamp.toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Error in successful bid post-processing:', error);
    }
  }

  private async handleFailedBid(bidData: any, errorMessage: string): Promise<void> {
    try {
      const { auctionId, userId, bidAmount } = bidData;

      // Send failure notification
      await this.rabbitmqService.publishNotification({
        type: 'BID_FAILED',
        userId,
        auctionId,
        message: `Failed to place bid: ${errorMessage}`,
        data: {
          bidAmount,
          error: errorMessage,
        }
      });

      // Log failure in audit
      await this.rabbitmqService.publishAuditLog({
        action: 'BID_FAILED',
        auctionId,
        userId,
        success: false,
        details: {
          bidAmount,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Error in failed bid handling:', error);
    }
  }
}