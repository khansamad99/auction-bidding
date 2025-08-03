import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Auction, AuctionDocument } from '../database/schemas/auction.schema';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { AuctionStatus } from '../common/enums/auction.enum';

@Injectable()
export class AuctionsService {
  constructor(
    @InjectModel(Auction.name) private auctionModel: Model<AuctionDocument>,
  ) {}

  async create(createAuctionDto: CreateAuctionDto): Promise<Auction> {
    const startTime = new Date(createAuctionDto.startTime);
    const endTime = new Date(createAuctionDto.endTime);
    const now = new Date();

    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Allow auctions to start immediately for testing
    const shouldStartImmediately = startTime <= now;
    const status = shouldStartImmediately ? AuctionStatus.ACTIVE : AuctionStatus.PENDING;

    const auction = new this.auctionModel({
      ...createAuctionDto,
      startTime: shouldStartImmediately ? now : startTime,
      endTime,
      currentHighestBid: createAuctionDto.startingBid,
      status,
    });

    return auction.save();
  }

  async findAll(status?: AuctionStatus): Promise<Auction[]> {
    const filter = status ? { status } : {};
    return this.auctionModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findActive(): Promise<Auction[]> {
    const now = new Date();
    return this.auctionModel
      .find({
        status: AuctionStatus.ACTIVE,
        startTime: { $lte: now },
        endTime: { $gt: now },
      })
      .sort({ endTime: 1 })
      .exec();
  }

  async findUpcoming(): Promise<Auction[]> {
    const now = new Date();
    return this.auctionModel
      .find({
        status: AuctionStatus.PENDING,
        startTime: { $gt: now },
      })
      .sort({ startTime: 1 })
      .exec();
  }

  async findOne(id: string): Promise<AuctionDocument> {
    const auction = await this.auctionModel.findById(id).exec();
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }
    return auction;
  }

  async update(id: string, updateAuctionDto: UpdateAuctionDto): Promise<Auction> {
    const auction = await this.findOne(id);
    
    if (auction.status === AuctionStatus.ACTIVE) {
      throw new BadRequestException('Cannot update active auction');
    }

    if (auction.status === AuctionStatus.ENDED) {
      throw new BadRequestException('Cannot update ended auction');
    }

    const updated = await this.auctionModel
      .findByIdAndUpdate(id, updateAuctionDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Auction not found');
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const auction = await this.findOne(id);
    
    if (auction.status === AuctionStatus.ACTIVE) {
      throw new BadRequestException('Cannot delete active auction');
    }

    const result = await this.auctionModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Auction not found');
    }
  }

  async startAuction(id: string): Promise<Auction> {
    const auction = await this.findOne(id);
    const now = new Date();

    if (auction.status !== AuctionStatus.PENDING) {
      throw new BadRequestException('Only pending auctions can be started');
    }

    if (auction.startTime > now) {
      throw new BadRequestException('Auction start time has not arrived yet');
    }

    auction.status = AuctionStatus.ACTIVE;
    return auction.save();
  }

  async endAuction(id: string, winnerId?: string): Promise<Auction> {
    const auction = await this.findOne(id);

    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new BadRequestException('Only active auctions can be ended');
    }

    auction.status = AuctionStatus.ENDED;
    if (winnerId) {
      auction.winnerId = winnerId as any;
    }
    
    return auction.save();
  }

  async updateHighestBid(id: string, bidAmount: number, winnerId: string): Promise<Auction> {
    const auction = await this.auctionModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            currentHighestBid: bidAmount,
            winnerId: winnerId,
          },
          $inc: { bidCount: 1 },
        },
        { new: true }
      )
      .exec();

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    return auction;
  }

  async getAuctionStats(id: string): Promise<any> {
    const auction = await this.findOne(id);
    const now = new Date();
    
    return {
      id: auction._id,
      title: auction.title,
      status: auction.status,
      currentHighestBid: auction.currentHighestBid,
      bidCount: auction.bidCount,
      timeRemaining: auction.endTime.getTime() - now.getTime(),
      isActive: auction.status === AuctionStatus.ACTIVE && auction.endTime > now,
    };
  }
}