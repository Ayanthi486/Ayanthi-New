import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env.validation';

const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(ConfigService<EnvConfig, true>);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });

  // /healthz stays outside API versioning so uptime monitors and load
  // balancer probes can hit a stable, unversioned path (ARCHITECTURE §23).
  app.setGlobalPrefix(API_PREFIX, { exclude: ['healthz'] });

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Hub Lanka Pvt Limited API')
      .setDescription('Hub Lanka Pvt Limited — Freight Forwarding Management System REST API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
  }

  const port = config.get('API_PORT', { infer: true });
  const host = config.get('API_HOST', { infer: true });

  await app.listen(port, host);
  logger.log(`Hub Lanka API listening on http://${host}:${port}/${API_PREFIX}`);
}

void bootstrap();
