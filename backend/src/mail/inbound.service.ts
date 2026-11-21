import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual, randomUUID } from 'crypto';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { simpleParser } from 'mailparser';
import { Mailbox, MessageState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../search/elasticsearch.service';
import { AttachmentScanner } from '../messages/attachment-scanner.service';
import { htmlEmailToText } from '../common/html-email-to-text';

@Injectable()
export class InboundService {
  private readonly logger = new Logger('Inbound');
  private readonly token: string;
  private readonly storageDir = process.env.ATTACHMENTS_DIR || join(process.cwd(), 'uploads');
  private readonly maxAttachmentBytes = 5 * 1024 * 1024;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
    private es: ElasticsearchService,
    private scanner: AttachmentScanner,
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
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequestException('Invalid inbound payload');
    for (const key of ['provider', 'messageId', 'rawMime', 'from', 'subject', 'text', 'html'] as const) {
      if (payload[key] !== undefined && typeof payload[key] !== 'string') throw new BadRequestException(`${key} must be a string`);
    }
    if (payload.to !== undefined && typeof payload.to !== 'string' && !Array.isArray(payload.to)) throw new BadRequestException('to must be a string or array');
    if (Array.isArray(payload.to) && payload.to.some(value => typeof value !== 'string')) throw new BadRequestException('to array must contain only strings');
    if (!payload.rawMime && !payload.to) throw new BadRequestException('Provide rawMime or recipient information');

    if (payload.rawMime && Buffer.byteLength(payload.rawMime, 'utf8') > 5 * 1024 * 1024) throw new BadRequestException('Inbound MIME payload exceeds 5 MB limit');
    let parsed = null;
    if (payload.rawMime) {
      try {
        parsed = await simpleParser(Buffer.from(payload.rawMime));
      } catch (error) {
        throw new BadRequestException('Inbound MIME payload could not be parsed');
      }
    }
    const recipients = this.normalizeAddresses(payload.to ?? parsed?.to);
    if (!recipients.length) throw new BadRequestException('No recipient address found');
    if (recipients.length > 50) throw new BadRequestException('Inbound message exceeds the 50-recipient limit');
    const provider = (payload.provider ?? 'webhook').trim().replace(/[\\u0000-\\u001f\\u007f]/g, '').slice(0, 64) || 'webhook';
    const providerMessageId = (payload.messageId ?? parsed?.messageId ?? createHash('sha256').update(payload.rawMime ?? JSON.stringify(payload)).digest('hex')).trim().replace(/[\\u0000-\\u001f\\u007f]/g, '').slice(0, 255) || createHash('sha256').update(payload.rawMime ?? JSON.stringify(payload)).digest('hex').slice(0, 64);

    const from = this.normalizeAddresses(payload.from ?? parsed?.from)[0] ?? 'unknown@unknown';
    const subject = payload.subject ?? parsed?.subject ?? '';
    const html = payload.html ?? (parsed?.html ? String(parsed.html) : '');
    const text = payload.text ?? parsed?.text ?? '';
    // Convert untrusted HTML to plain text using the shared safe converter.
    const body = htmlEmailToText(String(text || html || ''));
    const snippet = body.slice(0, 160);
    const attachments = (parsed?.attachments ?? []).filter(a => a.content?.length);
    const totalAttachmentBytes = attachments.reduce((sum, a) => sum + a.content.length, 0);
    if (totalAttachmentBytes > this.maxAttachmentBytes) throw new BadRequestException('Inbound attachments exceed 5 MB total limit');
    const scanStatuses = await Promise.all(attachments.map(a => this.scanner.scan(a.content)));
    if (scanStatuses.includes('INFECTED')) throw new BadRequestException('Inbound message rejected: malware detected in an attachment');
    const results: Array<{ recipient: string; status: string }> = [];

    for (const recipient of recipients) {
      const user = await this.prisma.user.findFirst({ where: { email: recipient, isActive: true } });
      if (!user) { results.push({ recipient, status: 'UNROUTABLE' }); continue; }
      let receipt: { id: string };
      try {
        receipt = await this.prisma.inboundReceipt.create({ data: { provider, providerMessageId, recipient, ownerId: user.id } });
      } catch (e) {
        // Duplicate receipt is idempotent. Failed receipts may be safely retried.
        if ((e as { code?: string }).code === 'P2002') {
          const existing = await this.prisma.inboundReceipt.findUnique({ where: { provider_providerMessageId_recipient: { provider, providerMessageId, recipient } } });
          if (!existing || existing.status === 'PROCESSED') { results.push({ recipient, status: 'DUPLICATE' }); continue; }
          receipt = await this.prisma.inboundReceipt.update({ where: { id: existing.id }, data: { status: 'RECEIVED', error: null, messageId: null } });
        } else throw e;
      }
      let createdMessageId: string | null = null;
      const writtenFiles: string[] = [];
      try {
        const existingMessage = await this.prisma.message.findFirst({ where: { ownerId: user.id, labels: { has: `mid:${providerMessageId}` } } });
        if (existingMessage) {
          await this.prisma.inboundReceipt.update({ where: { id: receipt.id }, data: { status: 'PROCESSED', messageId: existingMessage.id, processedAt: new Date() } });
          results.push({ recipient, status: 'DUPLICATE' });
          continue;
        }
        const message = await this.prisma.message.create({ data: {
          ownerId: user.id, from, to: [recipient], subject, body, snippet,
          mailbox: Mailbox.INBOX, state: MessageState.RECEIVED,
          labels: ['INBOUND', `provider:${provider}`, `mid:${providerMessageId}`],
          hasAttachments: attachments.length > 0,
        } });
        createdMessageId = message.id;
        for (let index = 0; index < attachments.length; index++) {
          const attachment = attachments[index];
          const storageName = randomUUID();
          const originalName = (attachment.filename || 'attachment').replace(/[\\/\\\\]/g, '_').replace(/[\\u0000-\\u001f\\u007f]/g, '_').trim().slice(0, 255) || 'attachment';
          await mkdir(this.storageDir, { recursive: true });
          await writeFile(join(this.storageDir, storageName), attachment.content, { flag: 'wx' });
          writtenFiles.push(storageName);
          await this.prisma.attachment.create({ data: {
            messageId: message.id, originalName, storageName,
            mimeType: attachment.contentType || 'application/octet-stream',
            size: attachment.content.length, scanStatus: scanStatuses[index],
          } });
        }
        await this.prisma.inboundReceipt.update({ where: { id: receipt.id }, data: { status: 'PROCESSED', messageId: message.id, processedAt: new Date() } });
        await this.es.indexMessage(message).catch(e => this.logger.warn('Inbound search indexing failed: ' + (e as Error).message));
        await this.redis.invalidatePrefix(`messages:${user.id}:`).catch(() => undefined);
        results.push({ recipient, status: 'PROCESSED' });
      } catch (e) {
        // Roll back partial inbound persistence so a retry cannot mistake an
        // incomplete message for a successfully imported duplicate.
        if (createdMessageId) {
          await this.prisma.message.delete({ where: { id: createdMessageId } }).catch(() => undefined);
        }
        await Promise.all(writtenFiles.map(name => unlink(join(this.storageDir, name)).catch(() => undefined)));
        await this.prisma.inboundReceipt.update({ where: { id: receipt.id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 1000), messageId: null } }).catch(() => undefined);
        results.push({ recipient, status: 'FAILED' });
        this.logger.error('Inbound processing failed', (e as Error).message);
      }
    }
    return { accepted: true, provider, providerMessageId, recipients: results, attachmentCount: attachments.length, attachmentBytes: totalAttachmentBytes, note: attachments.length ? (scanStatuses.includes('UNCHECKED') ? 'Attachments stored; ClamAV is not configured, so these files remain unscanned.' : 'Attachments stored and scanned with ClamAV.') : undefined };
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
