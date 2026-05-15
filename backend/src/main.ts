import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);
  const uploadDir = config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  // Static files are mounted at /uploads/ (no global prefix). The upload
  // controller at /api/v1/uploads/image is distinct and unaffected.
  app.setGlobalPrefix('api/v1');
  app.enableCors();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Chatbot backend listening on http://localhost:${port}/api/v1`);
  console.log(`Static uploads served from http://localhost:${port}/uploads/*`);
}

bootstrap();
