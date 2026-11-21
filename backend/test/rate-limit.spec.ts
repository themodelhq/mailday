import { RateLimitService } from '../src/auth/rate-limit.service';

describe('RateLimitService', () => {
  it('uses atomic Redis increment and returns remaining quota', async () => {
    const redis: any = { client: { eval: jest.fn(async () => [3, 42]) } };
    const service = new RateLimitService(redis);
    await expect(service.consume('key', 5, 60)).resolves.toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 42 });
    expect(redis.client.eval).toHaveBeenCalledWith(expect.any(String), 1, 'key', '60');
  });

  it('allows the exact limit and reports zero remaining', async () => {
    const redis: any = { client: { eval: jest.fn(async () => [5, 17]) } };
    const service = new RateLimitService(redis);
    await expect(service.consume('key', 5, 60)).resolves.toEqual({ allowed: true, remaining: 0, retryAfterSeconds: 17 });
  });

  it('blocks requests above the configured limit', async () => {
    const redis: any = { client: { eval: jest.fn(async () => [6, 60]) } };
    const service = new RateLimitService(redis);
    await expect(service.consume('key', 5, 60)).resolves.toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
  });

  it('never returns a zero or negative retry interval when Redis TTL is missing', async () => {
    const redis: any = { client: { eval: jest.fn(async () => [1, -2]) } };
    const service = new RateLimitService(redis);
    const result = await service.consume('key', 5, 60);
    expect(result.retryAfterSeconds).toBe(1);
  });

  it('passes the configured window to Redis and calculates remaining quota from the count', async () => {
    const redis: any = { client: { eval: jest.fn(async () => [8, 9]) } };
    const service = new RateLimitService(redis);
    await expect(service.consume('login:ip', 10, 300)).resolves.toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 9 });
    expect(redis.client.eval).toHaveBeenCalledWith(expect.any(String), 1, 'login:ip', '300');
  });
});
