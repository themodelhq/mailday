import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { randomUUID } from 'crypto';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('MailDay');

  // Last-resort safety net: an unhandled rejection anywhere in the app (a missed
  // .catch(), a fire-and-forget async call, etc.) crashes the whole Node process
  // by default on Node 15+. Log it loudly instead so one bad background task
  // can't take the entire API down.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason instanceof Error ? reason.stack : String(reason));
  });

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Let Nest close HTTP and provider resources on Render SIGTERM/SIGINT.
  app.enableShutdownHooks();
  // Lightweight request observability: a server-generated correlation ID and
  // method/path/status/latency logs. Query strings are intentionally omitted.
  app.use((req, res, next) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    res.setHeader('X-Request-ID', requestId);
    res.on('finish', () => {
      logger.log(JSON.stringify({
        type: 'http_request',
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      }));
    });
    next();
  });

  // Inbound MIME webhook accepts up to 5 MB plus JSON overhead.
  app.use(json({ limit: '6mb' }));
  app.use(urlencoded({ extended: true, limit: '6mb' }));

  const config = app.get(ConfigService);

  // FRONTEND_URL can hold one or more comma-separated origins (useful when a
  // prod Netlify domain plus deploy-preview URLs are configured).
  const configuredOrigins = (config.get<string>('FRONTEND_URL') ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const allowedOrigins = new Set<string>([
    ...configuredOrigins,
    'http://localhost:3000',
  ]);

  if (allowedOrigins.size === 1) {
    logger.warn(
      'FRONTEND_URL is not set — only http://localhost:3000 will be allowed by CORS. ' +
        'Set FRONTEND_URL to the deployed frontend origin.',
    );
  }

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server, health checks) with no Origin header.
      if (!origin) return callback(null, true);

      const normalized = origin.replace(/\/+$/, '');
      if (allowedOrigins.has(normalized)) return callback(null, true);

      logger.warn(`Blocked CORS request from origin: ${origin}`);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
  });

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  logger.log(`MailDay API listening on port ${port}`);
}

bootstrap();
