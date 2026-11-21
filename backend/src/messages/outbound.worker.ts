import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class OutboundWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('OutboundWorker');
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly enabled = (process.env.OUTBOUND_WORKER_ENABLED ?? 'true') !== 'false';
  private readonly pollMs = Math.max(1000, Number(process.env.OUTBOUND_WORKER_POLL_MS ?? 5000));

  constructor(private prisma: PrismaService, private redis: RedisService, private mail: MailService) {}

  onModuleInit() {
    if (!this.enabled) { this.logger.warn('Outbound worker disabled by configuration'); return; }
    this.timer = setInterval(() => void this.tick(), this.pollMs);
    this.timer.unref?.();
    void this.tick();
    this.logger.log(`Outbound worker started (poll=${this.pollMs}ms)`);
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async tick() {
    if (this.running || !this.mail.enabled) return;
    this.running = true;
    try {
      // Recover jobs abandoned by a crashed worker after the processing lease expires.
      await this.prisma.outboundDelivery.updateMany({
        where: { status: 'PROCESSING', lockedAt: { lt: new Date(Date.now() - 3 * 60 * 1000) } },
        data: { status: 'RETRYING', lockedAt: null, nextAttemptAt: new Date() },
      });
      const due = await this.prisma.outboundDelivery.findMany({
        where: { status: { in: ['QUEUED', 'RETRYING'] }, nextAttemptAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' }, take: 10, select: { id: true },
      });
      for (const item of due) await this.process(item.id);
    } catch (e) { this.logger.error('Queue polling error', (e as Error).message); }
    finally { this.running = false; }
  }

  private async process(id: string) {
    const lockKey = `mailday:outbound:${id}`;
    const token = await this.redis.acquireLock(lockKey, 180);
    if (!token) return;
    try {
      const delivery = await this.prisma.outboundDelivery.findUnique({ where: { id }, include: { message: { include: { attachments: true } } } });
      if (!delivery || !['QUEUED', 'RETRYING'].includes(delivery.status) || delivery.nextAttemptAt > new Date()) return;
      await this.prisma.outboundDelivery.update({ where: { id }, data: { status: 'PROCESSING', lockedAt: new Date(), attempts: { increment: 1 } } });
      const result = await this.mail.send(delivery.message.to, delivery.message.subject, delivery.message.body, delivery.message.cc, delivery.message.bcc, delivery.message.attachments);
      if (result.sent) {
        await this.prisma.$transaction([
          this.prisma.outboundDelivery.update({ where: { id }, data: { status: 'SENT', providerMessageId: result.messageId ?? null, lastError: null, sentAt: new Date(), lockedAt: null } }),
          this.prisma.message.update({ where: { id: delivery.messageId }, data: { state: 'SENT', sentAt: new Date() } }),
        ]);
        this.logger.log(`Delivery ${id} accepted by SMTP`);
        return;
      }
      const attempts = delivery.attempts + 1;
      const terminal = result.retryable === false || attempts >= delivery.maxAttempts;
      const delay = Math.min(3600, Math.pow(2, attempts) * 30);
      await this.prisma.$transaction([
        this.prisma.outboundDelivery.update({ where: { id }, data: { status: terminal ? 'FAILED' : 'RETRYING', lastError: result.error ?? 'Delivery failed', nextAttemptAt: terminal ? new Date() : new Date(Date.now() + delay * 1000), failedAt: terminal ? new Date() : null, lockedAt: null } }),
        this.prisma.message.update({ where: { id: delivery.messageId }, data: { state: terminal ? 'FAILED' : 'QUEUED' } }),
      ]);
      if (terminal && result.retryable === false) this.logger.warn(`Delivery ${id} failed permanently (${result.errorCode ?? 'unknown code'})`);
    } catch (e) {
      const delivery = await this.prisma.outboundDelivery.findUnique({ where: { id } });
      if (delivery) {
        const terminal = delivery.attempts >= delivery.maxAttempts;
        const delay = Math.min(3600, Math.pow(2, Math.max(1, delivery.attempts)) * 30);
        await this.prisma.outboundDelivery.update({ where: { id }, data: { status: terminal ? 'FAILED' : 'RETRYING', lastError: (e as Error).message.slice(0, 2000), nextAttemptAt: new Date(Date.now() + delay * 1000), failedAt: terminal ? new Date() : null, lockedAt: null } }).catch(() => undefined);
        await this.prisma.message.update({ where: { id: delivery.messageId }, data: { state: terminal ? 'FAILED' : 'QUEUED' } }).catch(() => undefined);
      }
      this.logger.error(`Delivery ${id} processing error`, (e as Error).message);
    } finally { await this.redis.releaseLock(lockKey, token).catch(() => undefined); }
  }
}
