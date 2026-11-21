import { RateLimitService } from '../src/auth/rate-limit.service';

describe('RateLimitService', () => {
  it('uses atomic Redis increment and returns remaining quota', async () => {
    const redis: any = { client: { eval: jest.fn(async () => [3, 42]) } };
    const service = new RateLimitService(redis);
    await expect(service.consume('key', 5, 60)).resolves.toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 42 });
    expect(redis.client.eval).toHaveBeenCalledWith(expect.any(String), 1, 'key', '60');
  });

  it('blocks requests above the configured limit', async () => {
    const redis: any = { client: { eval: jest.fn(async () => [6, 60]) } };
    const service = new RateLimitService(redis);
    await expect(service.consume('key', 5, 60)).resolves.toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
  });
});
