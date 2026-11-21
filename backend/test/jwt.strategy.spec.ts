import { JwtStrategy } from '../src/auth/jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy session and token validation', () => {
  let strategy: JwtStrategy;
  const redis = { client: { get: jest.fn() } } as any;
  const config = { get: jest.fn((key: string) => key === 'JWT_SECRET' ? 'test-secret' : 'test') } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(config, redis);
  });

  it('rejects payloads without subject or token id', async () => {
    await expect(strategy.validate({ sub: 'u1', jti: undefined } as any)).rejects.toThrow(UnauthorizedException);
    expect(redis.client.get).not.toHaveBeenCalled();
  });

  it('rejects revoked access tokens', async () => {
    redis.client.get.mockResolvedValueOnce('1');
    await expect(strategy.validate({ sub: 'u1', jti: 'j1', sv: 0 } as any)).rejects.toThrow('Token revoked');
    expect(redis.client.get).toHaveBeenCalledWith('auth:revoked:j1');
  });

  it('rejects tokens with stale session versions', async () => {
    redis.client.get.mockResolvedValueOnce(null).mockResolvedValueOnce('4');
    await expect(strategy.validate({ sub: 'u1', jti: 'j1', sv: 3 } as any)).rejects.toThrow('Session revoked');
    expect(redis.client.get).toHaveBeenNthCalledWith(2, 'auth:session-version:u1');
  });

  it('accepts a non-revoked token with the current session version', async () => {
    redis.client.get.mockResolvedValueOnce(null).mockResolvedValueOnce('2');
    await expect(strategy.validate({ sub: 'u1', email: 'a@b.com', username: 'a', role: 'USER', jti: 'j1', sv: 2 } as any))
      .resolves.toEqual({ id: 'u1', email: 'a@b.com', username: 'a', role: 'USER' });
  });

  it('supports pre-session-version tokens only while version is zero', async () => {
    redis.client.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(strategy.validate({ sub: 'u1', email: 'a@b.com', username: 'a', role: 'USER', jti: 'j1' } as any))
      .resolves.toEqual({ id: 'u1', email: 'a@b.com', username: 'a', role: 'USER' });
  });
});
