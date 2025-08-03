import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AuctionSeederService } from './database/seeders/auction-seeder';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS for frontend integration
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global prefix for API routes
  app.setGlobalPrefix('api');

  // Seed database in development
  if (configService.get('nodeEnv') === 'development') {
    try {
      const seeder = app.get(AuctionSeederService);
      await seeder.seedAuctions();
    } catch (error) {
      console.error('Failed to seed database:', error);
    }
  }

  const port = configService.get<number>('port') || 3000;
  await app.listen(port);
  
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🔗 API available at http://localhost:${port}/api`);
}
bootstrap();
