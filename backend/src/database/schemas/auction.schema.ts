import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AuctionStatus } from '../../common/enums/auction.enum';

export type AuctionDocument = Auction & Document;

@Schema({ timestamps: true })
export class Auction {
  @Prop({ required: true })
  carId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ required: true })
  startingBid: number;

  @Prop({ required: true, default: 0 })
  currentHighestBid: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  winnerId: Types.ObjectId;

  @Prop({ 
    required: true, 
    enum: AuctionStatus, 
    default: AuctionStatus.PENDING 
  })
  status: AuctionStatus;

  @Prop({ default: 0 })
  bidCount: number;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const AuctionSchema = SchemaFactory.createForClass(Auction);

// Create indexes for performance
AuctionSchema.index({ status: 1, startTime: 1 });
AuctionSchema.index({ endTime: 1 });
AuctionSchema.index({ currentHighestBid: -1 });