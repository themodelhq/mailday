import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  @Get()
  health() {
    return { status: 'ok', service: 'mailday-api', timestamp: new Date().toISOString() };
  }

  // Readiness check: Render/load balancers should only route traffic when the
  // app can reach both required infrastructure dependencies.
  @Get('ready')
  async readiness() {
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.client.ping(),
    ]);

    const dependencies = {
      database: checks[0].status === 'fulfilled' ? 'ok' : 'unavailable',
      redis: checks[1].status === 'fulfilled' ? 'ok' : 'unavailable',
    };
    const ready = Object.values(dependencies).every((status) => status === 'ok');
    const response = {
      status: ready ? 'ok' : 'unavailable',
      service: 'mailday-api',
      timestamp: new Date().toISOString(),
      dependencies,
    };

    if (!ready) throw new ServiceUnavailableException(response);
    return response;
  }
}
