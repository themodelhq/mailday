import { Inject, Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  private lastErrorLoggedAt = 0;
  constructor(@Inject('REDIS_CLIENT') public readonly client: Redis) {}

  async onModuleInit() {
    this.client.on('error', (err) => {
      // Avoid flooding the logs with the same connection error every retry attempt;
      // surface it at most once every 30s.
      const now = Date.now();
      if (now - this.lastErrorLoggedAt > 30000) {
        this.lastErrorLoggedAt = now;
        this.logger.error('Redis error', err?.message);
      }
    });
    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.logger.log('Redis client ready');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const v = await this.client.get(key);
    return v ? (JSON.parse(v) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const keys = await this.client.keys(`${prefix}*`);
    if (keys.length) await this.client.del(...keys);
  }
}
