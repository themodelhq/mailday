import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL');
    } catch (err) {
      this.logger.error('Failed to connect to PostgreSQL', (err as Error)?.message);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
