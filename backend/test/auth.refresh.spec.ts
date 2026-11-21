import { AuthService } from '../src/auth/auth.service';

describe('AuthService refresh-token rotation', () => {
  const prisma: any = {
    refreshToken: { findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const jwt: any = { verify: jest.fn(), sign: jest.fn(() => 'new-token') };
  const config: any = { get: jest.fn((key: string) => key === 'JWT_REFRESH_SECRET' ? 'refresh-secret' : key === 'JWT_SECRET' ? 'access-secret' : undefined) };
  const redis: any = { client: { get: jest.fn().mockResolvedValue('0') }, invalidatePrefix: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, jwt, config, redis);
    redis.client.get.mockResolvedValue('0');
  });

  it('consumes a refresh token exactly once and issues a replacement inside the transaction', async () => {
    const payload = { sub: 'u1', jti: 'old-jti', email: 'a@b.com', username: 'alice', role: 'USER' };
    jwt.verify.mockReturnValue(payload);
    prisma.refreshToken.findUnique.mockResolvedValue({ token: 'old-jti', userId: 'u1', expiresAt: new Date(Date.now() + 60_000) });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', username: 'alice', role: 'USER', isActive: true });
    const tx: any = { refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }), create: jest.fn().mockResolvedValue({}) } };
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await service.refresh({ refreshToken: 'old-refresh' });

    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token: 'old-jti', userId: 'u1' } });
    expect(tx.refreshToken.create).toHaveBeenCalled();
    expect(result).toEqual({ accessToken: 'new-token', refreshToken: 'new-token' });
    expect(redis.invalidatePrefix).toHaveBeenCalledWith('messages:u1:');
  });

  it('rejects a replay when the old token has already been consumed', async () => {
    jwt.verify.mockReturnValue({ sub: 'u1', jti: 'old-jti', email: 'a@b.com', username: 'alice', role: 'USER' });
    prisma.refreshToken.findUnique.mockResolvedValue({ token: 'old-jti', userId: 'u1', expiresAt: new Date(Date.now() + 60_000) });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, email: 'a@b.com', username: 'alice', role: 'USER' });
    const tx: any = { refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn() } };
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    await expect(service.refresh({ refreshToken: 'old-refresh' })).rejects.toThrow('Refresh token already used');
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
    expect(redis.invalidatePrefix).not.toHaveBeenCalled();
  });
});
