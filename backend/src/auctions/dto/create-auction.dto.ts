import { IsString, IsNumber, IsDateString, MinLength, Min } from 'class-validator';

export class CreateAuctionDto {
  @IsString()
  @MinLength(3)
  carId: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsNumber()
  @Min(1)
  startingBid: number;
}