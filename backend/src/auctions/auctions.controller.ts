import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query,
  UseGuards 
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuctionsService } from './auctions.service';
import { BidsService } from '../bids/bids.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { APIRateLimit } from '../common/guards/rate-limit.guard';
import { AuctionStatus } from '../common/enums/auction.enum';

@Controller('auctions')
@UseGuards(ThrottlerGuard)
@APIRateLimit()
export class AuctionsController {
  constructor(
    private readonly auctionsService: AuctionsService,
    private readonly bidsService: BidsService,
  ) {}

  @Post()
  create(@Body() createAuctionDto: CreateAuctionDto) {
    return this.auctionsService.create(createAuctionDto);
  }

  @Get()
  findAll(@Query('status') status?: AuctionStatus) {
    return this.auctionsService.findAll(status);
  }

  @Get('active')
  findActive() {
    return this.auctionsService.findActive();
  }

  @Get('upcoming')
  findUpcoming() {
    return this.auctionsService.findUpcoming();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auctionsService.findOne(id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.auctionsService.getAuctionStats(id);
  }

  @Get(':id/bids')
  async getAuctionBids(@Param('id') id: string) {
    return this.bidsService.findByAuction(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAuctionDto: UpdateAuctionDto) {
    return this.auctionsService.update(id, updateAuctionDto);
  }

  @Post(':id/start')
  startAuction(@Param('id') id: string) {
    return this.auctionsService.startAuction(id);
  }

  @Post(':id/end')
  endAuction(@Param('id') id: string, @Body('winnerId') winnerId?: string) {
    return this.auctionsService.endAuction(id, winnerId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.auctionsService.remove(id);
  }
}