import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { BidProcessorService } from './bid-processor.service';
import { Bid, BidSchema } from '../database/schemas/bid.schema';
import { Auction, AuctionSchema } from '../database/schemas/auction.schema';
import { User, UserSchema } from '../database/schemas/user.schema';
import { AuctionsModule } from '../auctions/auctions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bid.name, schema: BidSchema },
      { name: Auction.name, schema: AuctionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => AuctionsModule),
  ],
  controllers: [BidsController],
  providers: [BidsService, BidProcessorService],
  exports: [BidsService],
})
export class BidsModule {}