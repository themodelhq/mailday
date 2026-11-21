import { AuthService } from '../src/auth/auth.service';
import * as bcrypt from 'bcryptjs';

const mockPrisma: any = {
  user: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockJwt: any = { sign: jest.fn(() => 'tok'), verify: jest.fn(() => ({})) };
const mockConfig: any = { get: (k: string) => (k === 'JWT_EXPIRES_IN' ? '15m' : '7d') };
const mockRedis: any = { invalidatePrefix: jest.fn(), client: { get: jest.fn().mockResolvedValue(null), incr: jest.fn().mockResolvedValue(1), set: jest.fn().mockResolvedValue('OK') } };

describe('AuthService (security-critical logic)', () => {
  let service: AuthService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(mockPrisma, mockJwt, mockConfig, mockRedis);
  });

  it('hashes the password with bcrypt before storing', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', username: 'a' });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const tokens = await service.register({
      email: 'a@b.com',
      username: 'a',
      password: 'secret123',
      displayName: 'A',
    });

    const created = mockPrisma.user.create.mock.calls[0][0].data;
    expect(created.passwordHash).not.toBe('secret123');
    expect(created.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    expect(mockJwt.sign).toHaveBeenCalledTimes(2); // access + refresh
    expect(tokens.accessToken).toBe('tok');
    expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
  });

  it('rejects duplicate email/username', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.register({ email: 'a@b.com', username: 'a', password: 'secret123' }),
    ).rejects.toThrow();
  });

  it('returns tokens for valid credentials', async () => {
    const hash = await bcrypt.hash('secret123', 12);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      username: 'a',
      passwordHash: hash,
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const tokens = await service.login({ identifier: 'a@b.com', password: 'secret123' });
    expect(tokens.accessToken).toBe('tok');
  });

  it('throws on wrong password', async () => {
    const hash = await bcrypt.hash('secret123', 12);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      username: 'a',
      passwordHash: hash,
    });
    await expect(
      service.login({ identifier: 'a@b.com', password: 'wrong' }),
    ).rejects.toThrow();
  });
});


describe('AuthService session revocation', () => {
  let service: AuthService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(mockPrisma, mockJwt, mockConfig, mockRedis);
  });

  it('removes all refresh tokens and increments the session version on logout-all', async () => {
    mockPrisma.refreshToken.deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    mockRedis.client.incr.mockResolvedValue(2);
    await expect(service.logoutAll('u1')).resolves.toEqual({ success: true });
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(mockRedis.client.incr).toHaveBeenCalledWith('auth:session-version:u1');
  });

  it('revokes the supplied access token until its expiry', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    mockJwt.verify.mockReturnValueOnce({ jti: 'refresh-jti' }).mockReturnValueOnce({ jti: 'access-jti', exp });
    mockPrisma.refreshToken.delete = jest.fn().mockResolvedValue({});
    await expect(service.logout('refresh-token', 'access-token')).resolves.toEqual({ success: true });
    expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { token: 'refresh-jti' } });
    expect(mockRedis.client.set).toHaveBeenCalledWith('auth:revoked:access-jti', '1', 'EX', expect.any(Number));
  });
});
