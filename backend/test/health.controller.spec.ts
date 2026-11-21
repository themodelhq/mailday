import { HealthController } from '../src/health/health.controller';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  const prisma = { $queryRaw: jest.fn() };
  const redis = { client: { ping: jest.fn() } };
  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController(prisma as any, redis as any);
  });

  it('returns a lightweight liveness response', () => {
    const result = controller.health();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('mailday-api');
    expect(result.timestamp).toBeTruthy();
  });

  it('reports ready when PostgreSQL and Redis are reachable', async () => {
    prisma.$queryRaw.mockResolvedValue(1);
    redis.client.ping.mockResolvedValue('PONG');

    await expect(controller.readiness()).resolves.toMatchObject({
      status: 'ok',
      dependencies: { database: 'ok', redis: 'ok' },
    });
  });

  it('returns service unavailable if a required dependency fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));
    redis.client.ping.mockResolvedValue('PONG');

    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    try {
      await controller.readiness();
    } catch (error) {
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        status: 'unavailable',
        dependencies: { database: 'unavailable', redis: 'ok' },
      });
    }
  });

  it('reports Redis unavailable when its ping fails', async () => {
    prisma.$queryRaw.mockResolvedValue(1);
    redis.client.ping.mockRejectedValue(new Error('redis unavailable'));

    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
