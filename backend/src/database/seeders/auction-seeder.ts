import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Auction } from '../schemas/auction.schema';
import { User } from '../schemas/user.schema';
import { AuctionStatus } from '../../common/enums/auction.enum';

@Injectable()
export class AuctionSeederService {
  private readonly logger = new Logger(AuctionSeederService.name);

  constructor(
    @InjectModel(Auction.name) private auctionModel: Model<Auction>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async seedAuctions() {
    const existingAuctions = await this.auctionModel.countDocuments();
    if (existingAuctions > 0) {
      this.logger.log('Auctions already exist, skipping seeding');
      return;
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const sampleAuctions = [
      {
        carId: 'CAR001',
        title: '2023 Ferrari F8 Tributo',
        description: 'A stunning red Ferrari F8 Tributo with only 2,000 miles. Features include carbon fiber trim, premium leather interior, and advanced driver assistance systems.',
        startTime: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
        endTime: new Date(now.getTime() + 25 * 60 * 60 * 1000), // 25 hours from now
        startingBid: 250000,
        currentHighestBid: 250000,
        status: AuctionStatus.PENDING,
        bidCount: 0,
      },
      {
        carId: 'CAR002',
        title: '2022 Lamborghini Huracán EVO',
        description: 'Pristine white Lamborghini Huracán EVO with 3,500 miles. All-wheel drive, naturally aspirated V10 engine, and immaculate interior.',
        startTime: new Date(now.getTime() - 60 * 60 * 1000), // Started 1 hour ago
        endTime: new Date(now.getTime() + 23 * 60 * 60 * 1000), // 23 hours from now
        startingBid: 200000,
        currentHighestBid: 225000,
        status: AuctionStatus.ACTIVE,
        bidCount: 8,
      },
      {
        carId: 'CAR003',
        title: '2021 Porsche 911 Turbo S',
        description: 'Silver metallic Porsche 911 Turbo S with 5,200 miles. Twin-turbo flat-six engine, PDK transmission, and sport chrono package.',
        startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
        endTime: new Date(now.getTime() + 26 * 60 * 60 * 1000), // 26 hours from now
        startingBid: 180000,
        currentHighestBid: 180000,
        status: AuctionStatus.PENDING,
        bidCount: 0,
      },
      {
        carId: 'CAR004',
        title: '2020 McLaren 720S',
        description: 'Papaya orange McLaren 720S with 4,800 miles. Carbon fiber body, luxury interior package, and track telemetry system.',
        startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Started 2 hours ago
        endTime: new Date(now.getTime() + 22 * 60 * 60 * 1000), // 22 hours from now
        startingBid: 280000,
        currentHighestBid: 305000,
        status: AuctionStatus.ACTIVE,
        bidCount: 12,
      },
      {
        carId: 'CAR005',
        title: '2019 Aston Martin DB11 V12',
        description: 'British racing green Aston Martin DB11 with 8,200 miles. Twin-turbo V12 engine, premium leather interior, and Bang & Olufsen sound system.',
        startTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
        startingBid: 160000,
        currentHighestBid: 160000,
        status: AuctionStatus.PENDING,
        bidCount: 0,
      },
      {
        carId: 'CAR006',
        title: '2023 Bentley Continental GT Speed',
        description: 'Midnight emerald Bentley Continental GT Speed with 1,200 miles. W12 engine, diamond quilted leather, and rotating display.',
        startTime: new Date(now.getTime() - 48 * 60 * 60 * 1000), // Started 2 days ago
        endTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Ended yesterday
        startingBid: 220000,
        currentHighestBid: 248000,
        status: AuctionStatus.ENDED,
        bidCount: 15,
      },
    ];

    try {
      await this.auctionModel.insertMany(sampleAuctions);
      this.logger.log(`Successfully seeded ${sampleAuctions.length} auctions`);
    } catch (error) {
      this.logger.error('Failed to seed auctions:', error);
      throw error;
    }
  }
}