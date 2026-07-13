import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JsonLogger } from './infrastructure/logging/json-logger';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const production = config.get<string>('NODE_ENV') === 'production';
  app.useLogger(new JsonLogger());
  app.enableShutdownHooks();
  app.use(helmet({ contentSecurityPolicy: production ? undefined : false }));
  app.enableCors({
    origin: config
      .getOrThrow<string>('FRONTEND_URLS')
      .split(',')
      .map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-idempotency-key'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );
  if (!production) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Revorus Escrow API')
      .setDescription('Bank-adapter based escrow orchestration service')
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
}
void bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.stack : String(error),
    'Bootstrap',
  );
  process.exitCode = 1;
});
