import { NestFactory, Reflector } from '@nestjs/core';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port   = config.get<number>('PORT', 3001);

  // ── Global validation ────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip unknown properties from DTOs
      forbidNonWhitelisted: true, // throw 400 on unknown properties
      transform: true,          // auto-transform payloads to DTO class instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Class serialiser ─────────────────────────────────────────────────────
  // Honours @Exclude() and @Expose() decorators on entities/DTOs
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  // ── API prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log(`SkillsHub API running on http://localhost:${port}/api`);
}

bootstrap();
