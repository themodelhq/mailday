import { Injectable, NotFoundException, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, Mailbox, MessageState, Message } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../search/elasticsearch.service';
import { MailService } from '../mail/mail.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/messages.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { htmlEmailToText } from '../common/html-email-to-text';

interface ListInput {
  mailbox?: string;
  search?: string;
  page: number;
  limit: number;
}

type MessageSummary = Omit<Message, 'ownerId' | 'body' | 'createdAt' | 'updatedAt'>;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger('Messages');

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly es: ElasticsearchService,
    private readonly mail: MailService,
  ) {}

  private cachePrefix(userId: string) {
    return `messages:${userId}:`;
  }

  private toSummary(m: Message): MessageSummary {
    const { ownerId, body, createdAt, updatedAt, ...rest } = m;
    void ownerId;
    void body;
    void createdAt;
    void updatedAt;
    return rest;
  }

  private buildWhere(userId: string, input: ListInput) {
    const where: Prisma.MessageWhereInput = { ownerId: userId };
    if (input.mailbox) where.mailbox = input.mailbox as Mailbox;
    if (input.search) {
      where.OR = [
        { subject: { contains: input.search, mode: 'insensitive' } },
        { body: { contains: input.search, mode: 'insensitive' } },
        { from: { contains: input.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async list(user: AuthUser, input: ListInput) {
    if (input.search && this.es.enabled) return this.searchWithEs(user, input);

    const cacheKey = `${this.cachePrefix(user.id)}${input.mailbox ?? 'ALL'}:${input.search ?? ''}:${input.page}:${input.limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const skip = (input.page - 1) * input.limit;
    const where = this.buildWhere(user.id, input);
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where, orderBy: { sentAt: 'desc' }, skip, take: input.limit,
        select: {
          id: true, mailbox: true, state: true, from: true, to: true, subject: true,
          snippet: true, isRead: true, isStarred: true, isImportant: true, labels: true,
          hasAttachments: true, sentAt: true,
        },
      }),
      this.prisma.message.count({ where }),
    ]);
    const result = { items, page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) };
    await this.redis.set(cacheKey, result, 30);
    return result;
  }

  private async searchWithEs(user: AuthUser, input: ListInput) {
    const cacheKey = `es:${this.cachePrefix(user.id)}${input.mailbox ?? 'ALL'}:${input.search}:${input.page}:${input.limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;
    const { ids, total } = await this.es.searchIds(user.id, input.search!, input.mailbox, input.page, input.limit);
    if (ids.length === 0) {
      const empty = { items: [], page: input.page, limit: input.limit, total, pages: 0 };
      await this.redis.set(cacheKey, empty, 30);
      return empty;
    }
    const msgs = await this.prisma.message.findMany({ where: { id: { in: ids }, ownerId: user.id } });
    const order = new Map(ids.map((id, i) => [id, i]));
    msgs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const result = { items: msgs.map((m) => this.toSummary(m)), page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) };
    await this.redis.set(cacheKey, result, 30);
    return result;
  }

  async getById(user: AuthUser, id: string) {
    const msg = await this.prisma.message.findFirst({ where: { id, ownerId: user.id } });
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }

  async create(user: AuthUser, dto: CreateMessageDto) {
    const snippet = htmlEmailToText(dto.body ?? '').slice(0, 160);
    const mailbox = dto.mailbox ?? Mailbox.INBOX;
    const isOutbound = mailbox === Mailbox.SENT;
    const isDraft = mailbox === Mailbox.DRAFT;
    if (isOutbound && !(dto.to?.length || dto.cc?.length || dto.bcc?.length)) throw new BadRequestException('At least one recipient is required');
    if (dto.scheduledAt && new Date(dto.scheduledAt) <= new Date()) throw new BadRequestException('Scheduled send time must be in the future');

    if (isOutbound && !this.mail.enabled) {
      throw new ServiceUnavailableException('Outbound email is not configured. Your message was not queued.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          ownerId: user.id, from: user.email, to: dto.to ?? [], cc: dto.cc ?? [], bcc: dto.bcc ?? [],
          threadId: dto.threadId ?? (isOutbound ? randomUUID() : undefined), inReplyTo: dto.inReplyTo ?? undefined,
          subject: dto.subject ?? '', body: dto.body ?? '', snippet, mailbox,
          state: isOutbound ? MessageState.QUEUED : isDraft ? MessageState.DRAFT : MessageState.RECEIVED,
          labels: dto.labels ?? [], isImportant: dto.isImportant ?? false,
        },
      });
      if (isOutbound) {
        await tx.outboundDelivery.create({
          data: { ownerId: user.id, messageId: message.id, idempotencyKey: dto.idempotencyKey ?? undefined, nextAttemptAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined },
        });
      }
      return message;
    });

    await this.es.indexMessage(created);
    await this.redis.invalidatePrefix(this.cachePrefix(user.id));
    this.logger.log(isOutbound ? `Message ${created.id} queued for delivery` : `Message ${created.id} created for ${user.email}`);
    return created;
  }

  async getThread(user: AuthUser, threadId: string) {
    return this.prisma.message.findMany({ where: { ownerId: user.id, threadId }, orderBy: { sentAt: 'asc' } });
  }

  async sendDraft(user: AuthUser, id: string, idempotencyKey?: string, scheduledAt?: string) {
    const draft = await this.getById(user, id);
    if (draft.mailbox !== Mailbox.DRAFT || draft.state !== MessageState.DRAFT) {
      throw new BadRequestException('Only saved drafts can be sent');
    }
    if (!(draft.to.length || draft.cc.length || draft.bcc.length)) {
      throw new BadRequestException('At least one recipient is required');
    }
    if (scheduledAt && new Date(scheduledAt) <= new Date()) throw new BadRequestException('Scheduled send time must be in the future');
    if (!this.mail.enabled) {
      throw new ServiceUnavailableException('Outbound email is not configured. Your draft was not sent.');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.message.update({
        where: { id: draft.id },
        data: { mailbox: Mailbox.SENT, state: MessageState.QUEUED },
      });
      await tx.outboundDelivery.create({
        data: { ownerId: user.id, messageId: draft.id, idempotencyKey: idempotencyKey ?? undefined, nextAttemptAt: scheduledAt ? new Date(scheduledAt) : undefined },
      });
      return updated;
    });
    await this.es.updateMessage(result);
    await this.redis.invalidatePrefix(this.cachePrefix(user.id));
    return result;
  }

  async getDeliveryStatus(user: AuthUser, messageId: string) {
    const delivery = await this.prisma.outboundDelivery.findFirst({
      where: { messageId, ownerId: user.id },
      select: { id: true, status: true, attempts: true, maxAttempts: true, nextAttemptAt: true, providerMessageId: true, lastError: true, createdAt: true, updatedAt: true, sentAt: true, failedAt: true },
    });
    if (!delivery) throw new NotFoundException('Outbound delivery not found');
    return delivery;
  }

  async update(user: AuthUser, id: string, dto: UpdateMessageDto) {
    await this.getById(user, id);
    const updated = await this.prisma.message.update({
      where: { id },
      data: {
        ...(dto.to !== undefined ? { to: dto.to } : {}),
        ...(dto.cc !== undefined ? { cc: dto.cc } : {}),
        ...(dto.bcc !== undefined ? { bcc: dto.bcc } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.body !== undefined ? { body: dto.body, snippet: htmlEmailToText(dto.body).slice(0, 160) } : {}),
        ...(dto.isRead !== undefined ? { isRead: dto.isRead } : {}),
        ...(dto.isStarred !== undefined ? { isStarred: dto.isStarred } : {}),
        ...(dto.mailbox !== undefined ? { mailbox: dto.mailbox } : {}),
        ...(dto.labels !== undefined ? { labels: dto.labels } : {}),
      },
    });
    await this.es.updateMessage(updated);
    await this.redis.invalidatePrefix(this.cachePrefix(user.id));
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    await this.getById(user, id);
    await this.prisma.message.delete({ where: { id } });
    await this.es.removeMessage(id);
    await this.redis.invalidatePrefix(this.cachePrefix(user.id));
    return { success: true };
  }
}
