import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { BidsModule } from '../bids/bids.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { RedisModule } from '../redis/redis.module';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { WebSocketConnectionLimitService } from '../common/guards/websocket-connection-limit.guard';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BidsModule,
    AuctionsModule,
    RedisModule,
    RabbitmqModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: { 
          expiresIn: configService.get<string>('jwt.expiresIn', '1d') 
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [WebsocketGateway, WebSocketConnectionLimitService],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}