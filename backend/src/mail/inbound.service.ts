import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { simpleParser } from 'mailparser';
import { Mailbox, MessageState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../search/elasticsearch.service';

@Injectable()
export class InboundService {
  private readonly logger = new Logger('Inbound');
  private readonly token: string;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
    private es: ElasticsearchService,
  ) {
    this.token = config.get<string>('INBOUND_WEBHOOK_TOKEN') ?? '';
  }

  private checkToken(value?: string) {
    if (!this.token || !value) throw new UnauthorizedException('Inbound webhook is not configured or unauthorized');
    const a = Buffer.from(this.token);
    const b = Buffer.from(value);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Invalid inbound webhook token');
  }

  async receive(token: string | undefined, payload: { provider?: string; messageId?: string; rawMime?: string; from?: string; to?: string | string[]; subject?: string; text?: string; html?: string }) {
    this.checkToken(token);
    if (!payload || (!payload.rawMime && !payload.to)) throw new BadRequestException('Provide rawMime or recipient information');

    const parsed = payload.rawMime ? await simpleParser(Buffer.from(payload.rawMime)) : null;
    const recipients = this.normalizeAddresses(payload.to ?? parsed?.to);
    if (!recipients.length) throw new BadRequestException('No recipient address found');
    const provider = (payload.provider ?? 'webhook').slice(0, 64);
    const providerMessageId = (payload.messageId ?? parsed?.messageId ?? createHash('sha256').update(payload.rawMime ?? JSON.stringify(payload)).digest('hex')).slice(0, 255);

    const from = this.normalizeAddresses(payload.from ?? parsed?.from)[0] ?? 'unknown@unknown';
    const subject = payload.subject ?? parsed?.subject ?? '';
    const html = payload.html ?? (parsed?.html ? String(parsed.html) : '');
    const text = payload.text ?? parsed?.text ?? '';
    const body = html || text || '';
    const snippet = String(text || body.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').slice(0, 160);
    const attachments = parsed?.attachments ?? [];
    const results: Array<{ recipient: string; status: string }> = [];

    for (const recipient of recipients) {
      const user = await this.prisma.user.findFirst({ where: { email: recipient, isActive: true } });
      if (!user) { results.push({ recipient, status: 'UNROUTABLE' }); continue; }
      let receipt;
      try {
        receipt = await this.prisma.inboundReceipt.create({ data: { provider, providerMessageId, recipient, ownerId: user.id } });
      } catch (e) {
        // Duplicate provider message/recipient is an idempotent acknowledgement.
        if ((e as { code?: string }).code === 'P2002') { results.push({ recipient, status: 'DUPLICATE' }); continue; }
        throw e;
      }
      try {
        const message = await this.prisma.message.create({ data: {
          ownerId: user.id, from, to: [recipient], subject, body, snippet,
          mailbox: Mailbox.INBOX, state: MessageState.RECEIVED,
          labels: ['INBOUND', `provider:${provider}`, `mid:${providerMessageId}`],
          hasAttachments: attachments.length > 0,
        } });
        await this.prisma.inboundReceipt.update({ where: { id: receipt.id }, data: { status: 'PROCESSED', messageId: message.id, processedAt: new Date() } });
        await this.es.indexMessage(message).catch(e => this.logger.warn('Inbound search indexing failed: ' + (e as Error).message));
        await this.redis.invalidatePrefix(`messages:${user.id}:`).catch(() => undefined);
        results.push({ recipient, status: 'PROCESSED' });
      } catch (e) {
        await this.prisma.inboundReceipt.update({ where: { id: receipt.id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 1000) } }).catch(() => undefined);
        results.push({ recipient, status: 'FAILED' });
        this.logger.error('Inbound processing failed', (e as Error).message);
      }
    }
    return { accepted: true, provider, providerMessageId, recipients: results, attachmentCount: attachments.length, note: attachments.length ? 'Attachments detected but binary storage is not yet configured.' : undefined };
  }

  private normalizeAddresses(value: unknown): string[] {
    if (!value) return [];
    if (typeof value === 'string') return value.split(/[;,]/).map(v => v.trim().toLowerCase()).filter(Boolean);
    if (Array.isArray(value)) return value.flatMap(v => this.normalizeAddresses(v));
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return this.normalizeAddresses((value as { value?: Array<{ address?: string }> }).value?.map(v => v.address).filter(Boolean) ?? []);
    }
    if (typeof value === 'object' && value !== null && 'address' in value) return this.normalizeAddresses((value as { address?: string }).address);
    return [];
  }
}
