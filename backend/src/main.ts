import { NestFactory } from '@nestjs/core';
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

  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  // FRONTEND_URL can hold one or more comma-separated origins (useful when you
  // have a prod Netlify domain plus deploy-preview URLs). Trailing slashes are
  // stripped so a value like "https://maildayapp.netlify.app/" still matches
  // the browser's Origin header, which never has one.
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
        'Set FRONTEND_URL in your environment (e.g. Render dashboard) to your deployed frontend origin, ' +
        'such as https://maildayapp.netlify.app',
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
  logger.log(`MailDay API listening on http://localhost:${port}`);
}

bootstrap();
