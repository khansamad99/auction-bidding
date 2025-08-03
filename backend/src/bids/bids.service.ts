import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bid, BidDocument } from '../database/schemas/bid.schema';
import { AuctionsService } from '../auctions/auctions.service';
import { CreateBidDto, PlaceBidDto } from './dto/create-bid.dto';
import { AuctionStatus, BidStatus } from '../common/enums/auction.enum';
import { IBidEvent } from '../common/interfaces/auction.interface';

@Injectable()
export class BidsService {
  constructor(
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    private readonly auctionsService: AuctionsService,
  ) {}

  async placeBid(placeBidDto: PlaceBidDto): Promise<{ bid: Bid; bidEvent: IBidEvent }> {
    const { auctionId, bidAmount, userId } = placeBidDto;

    // Get auction and validate
    const auction = await this.auctionsService.findOne(auctionId);
    
    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new BadRequestException('Auction is not active');
    }

    const now = new Date();
    if (now < auction.startTime || now > auction.endTime) {
      throw new BadRequestException('Auction is not currently running');
    }

    if (bidAmount <= auction.currentHighestBid) {
      throw new BadRequestException(
        `Bid amount must be higher than current highest bid: ${auction.currentHighestBid}`
      );
    }

    // Check if user is already the highest bidder
    const currentHighestBid = await this.bidModel
      .findOne({ auctionId, isWinning: true })
      .populate('userId', 'username')
      .exec();

    if (currentHighestBid && currentHighestBid.userId.toString() === userId) {
      throw new BadRequestException('You are already the highest bidder');
    }

    // Use MongoDB transaction for atomic operations
    const session = await this.bidModel.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Mark previous winning bid as not winning
        if (currentHighestBid) {
          await this.bidModel
            .updateOne(
              { _id: currentHighestBid._id },
              { isWinning: false },
              { session }
            );
        }

        // Create new bid
        const bid = new this.bidModel({
          userId,
          auctionId,
          bidAmount,
          isWinning: true,
          status: BidStatus.ACCEPTED,
          timestamp: now,
        });

        await bid.save({ session });

        // Update auction with new highest bid
        await this.auctionsService.updateHighestBid(auctionId, bidAmount, userId);
      });

      await session.endSession();

      // Get the created bid with populated user data
      const newBid = await this.bidModel
        .findOne({ auctionId, isWinning: true })
        .populate('userId', 'username')
        .exec();

      if (!newBid) {
        throw new BadRequestException('Failed to retrieve created bid');
      }

      // Create bid event for real-time updates
      const bidEvent: IBidEvent = {
        auctionId,
        bidId: (newBid._id as any).toString(),
        userId,
        username: (newBid.userId as any).username,
        bidAmount,
        previousHighestBid: currentHighestBid?.bidAmount || auction.startingBid,
        timestamp: now,
      };

      return { bid: newBid, bidEvent };

    } catch (error) {
      await session.endSession();
      throw new BadRequestException('Failed to place bid due to concurrent bidding');
    }
  }

  async findByAuction(auctionId: string, limit: number = 50): Promise<Bid[]> {
    return this.bidModel
      .find({ auctionId })
      .populate('userId', 'username')
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async findByUser(userId: string, limit: number = 50): Promise<Bid[]> {
    return this.bidModel
      .find({ userId })
      .populate('auctionId', 'title currentHighestBid status')
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async getCurrentHighestBid(auctionId: string): Promise<Bid | null> {
    return this.bidModel
      .findOne({ auctionId, isWinning: true })
      .populate('userId', 'username')
      .exec();
  }

  async getBidHistory(auctionId: string, page: number = 1, limit: number = 20): Promise<{
    bids: Bid[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    
    const [bids, total] = await Promise.all([
      this.bidModel
        .find({ auctionId })
        .populate('userId', 'username')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bidModel.countDocuments({ auctionId }),
    ]);

    return {
      bids,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserBidCount(userId: string, auctionId: string): Promise<number> {
    return this.bidModel.countDocuments({ userId, auctionId });
  }

  async getAuctionBidStats(auctionId: string): Promise<{
    totalBids: number;
    uniqueBidders: number;
    averageBidAmount: number;
    currentHighestBid: number;
  }> {
    const [totalBids, uniqueBidders, avgResult, highestBid] = await Promise.all([
      this.bidModel.countDocuments({ auctionId }),
      this.bidModel.distinct('userId', { auctionId }).then(users => users.length),
      this.bidModel.aggregate([
        { $match: { auctionId: auctionId } },
        { $group: { _id: null, average: { $avg: '$bidAmount' } } }
      ]),
      this.bidModel.findOne({ auctionId, isWinning: true }),
    ]);

    return {
      totalBids,
      uniqueBidders,
      averageBidAmount: avgResult[0]?.average || 0,
      currentHighestBid: highestBid?.bidAmount || 0,
    };
  }

  async validateBidAmount(auctionId: string, bidAmount: number): Promise<boolean> {
    const auction = await this.auctionsService.findOne(auctionId);
    return bidAmount > auction.currentHighestBid;
  }
}