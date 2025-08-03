import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  UseGuards 
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BidsService } from './bids.service';
import { PlaceBidDto } from './dto/create-bid.dto';

@Controller('bids')
@UseGuards(ThrottlerGuard)
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Post()
  placeBid(@Body() placeBidDto: PlaceBidDto) {
    return this.bidsService.placeBid(placeBidDto);
  }

  @Get('auction/:auctionId')
  findByAuction(
    @Param('auctionId') auctionId: string,
    @Query('limit') limit?: number,
  ) {
    return this.bidsService.findByAuction(auctionId, limit);
  }

  @Get('auction/:auctionId/history')
  getBidHistory(
    @Param('auctionId') auctionId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.bidsService.getBidHistory(auctionId, page, limit);
  }

  @Get('auction/:auctionId/highest')
  getCurrentHighestBid(@Param('auctionId') auctionId: string) {
    return this.bidsService.getCurrentHighestBid(auctionId);
  }

  @Get('auction/:auctionId/stats')
  getAuctionBidStats(@Param('auctionId') auctionId: string) {
    return this.bidsService.getAuctionBidStats(auctionId);
  }

  @Get('user/:userId')
  findByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.bidsService.findByUser(userId, limit);
  }

  @Get('user/:userId/auction/:auctionId/count')
  getUserBidCount(
    @Param('userId') userId: string,
    @Param('auctionId') auctionId: string,
  ) {
    return this.bidsService.getUserBidCount(userId, auctionId);
  }
}