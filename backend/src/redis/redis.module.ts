import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis');
        let hasLoggedUnreachable = false;

        const client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            // Back off up to 30s between attempts instead of retrying every ~1s forever.
            const delay = Math.min(times * 1000, 30000);
            if (times === 5 && !hasLoggedUnreachable) {
              hasLoggedUnreachable = true;
              logger.warn(
                'Redis has failed to connect 5 times in a row. Check that REDIS_URL is correct ' +
                  'and that the Redis instance is running (e.g. a Render free-tier Redis add-on can expire).',
              );
            }
            return delay;
          },
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}
