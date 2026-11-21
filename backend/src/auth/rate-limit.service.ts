import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redis: RedisService) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
    const script = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      local ttl = redis.call('TTL', KEYS[1])
      return { count, ttl }
    `;
    const result = await this.redis.client.eval(script, 1, key, String(windowSeconds)) as [number, number];
    const count = Number(result[0]);
    const ttl = Math.max(1, Number(result[1]));
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: ttl };
  }
}
