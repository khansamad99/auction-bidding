import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BidStatus } from '../../common/enums/auction.enum';

export type BidDocument = Bid & Document;

@Schema({ timestamps: true })
export class Bid {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Auction', required: true })
  auctionId: Types.ObjectId;

  @Prop({ required: true })
  bidAmount: number;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ default: false })
  isWinning: boolean;

  @Prop({ 
    required: true, 
    enum: BidStatus, 
    default: BidStatus.PENDING 
  })
  status: BidStatus;
}

export const BidSchema = SchemaFactory.createForClass(Bid);

// Create indexes for performance
BidSchema.index({ auctionId: 1, timestamp: -1 });
BidSchema.index({ auctionId: 1, bidAmount: -1 });
BidSchema.index({ userId: 1, timestamp: -1 });
BidSchema.index({ isWinning: 1, auctionId: 1 });