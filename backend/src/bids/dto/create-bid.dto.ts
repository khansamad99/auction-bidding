import { IsString, IsNumber, Min } from 'class-validator';

export class CreateBidDto {
  @IsString()
  auctionId: string;

  @IsNumber()
  @Min(1)
  bidAmount: number;
}

export class PlaceBidDto {
  @IsString()
  auctionId: string;

  @IsNumber()
  @Min(1)
  bidAmount: number;

  @IsString()
  userId: string;
}