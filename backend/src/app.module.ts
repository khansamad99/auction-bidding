import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuctionsModule } from './auctions/auctions.module';
import { BidsModule } from './bids/bids.module';
import { AuthModule } from './auth/auth.module';
import { WebsocketModule } from './websocket/websocket.module';
import { RedisModule } from './redis/redis.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { AuctionSeederService } from './database/seeders/auction-seeder';
import { Auction, AuctionSchema } from './database/schemas/auction.schema';
import { User, UserSchema } from './database/schemas/user.schema';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Auction.name, schema: AuctionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: (configService.get<number>('throttle.ttl') || 60) * 1000,
            limit: configService.get<number>('throttle.limit') || 100,
          },
        ],
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuctionsModule,
    BidsModule,
    AuthModule,
    WebsocketModule,
    RedisModule,
    RabbitmqModule,
  ],
  controllers: [AppController],
  providers: [AppService, AuctionSeederService],
})
export class AppModule {}
