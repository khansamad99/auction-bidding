import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuctionsController } from './auctions.controller';
import { AuctionsService } from './auctions.service';
import { Auction, AuctionSchema } from '../database/schemas/auction.schema';
import { BidsModule } from '../bids/bids.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Auction.name, schema: AuctionSchema }]),
    forwardRef(() => BidsModule),
  ],
  controllers: [AuctionsController],
  providers: [AuctionsService],
  exports: [AuctionsService],
})
export class AuctionsModule {}