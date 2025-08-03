import { Module, Global } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq-simple.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RabbitmqService],
  exports: [RabbitmqService],
})
export class RabbitmqModule {}