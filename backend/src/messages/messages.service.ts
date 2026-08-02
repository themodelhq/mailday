import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, Mailbox, MessageState, Message } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../search/elasticsearch.service';
import { MailService } from '../mail/mail.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/messages.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';

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

  /** Hybrid search: Elasticsearch when configured, otherwise Prisma ILIKE. */
  async list(user: AuthUser, input: ListInput) {
    if (input.search && this.es.enabled) {
      return this.searchWithEs(user, input);
    }

    const cacheKey = `${this.cachePrefix(user.id)}${input.mailbox ?? 'ALL'}:${
      input.search ?? ''
    }:${input.page}:${input.limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const skip = (input.page - 1) * input.limit;
    const where = this.buildWhere(user.id, input);

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: input.limit,
        select: {
          id: true,
          mailbox: true,
          state: true,
          from: true,
          to: true,
          subject: true,
          snippet: true,
          isRead: true,
          isStarred: true,
          isImportant: true,
          labels: true,
          hasAttachments: true,
          sentAt: true,
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    const result = {
      items,
      page: input.page,
      limit: input.limit,
      total,
      pages: Math.ceil(total / input.limit),
    };
    await this.redis.set(cacheKey, result, 30);
    return result;
  }

  private async searchWithEs(user: AuthUser, input: ListInput) {
    const cacheKey = `es:${this.cachePrefix(user.id)}${input.mailbox ?? 'ALL'}:${
      input.search
    }:${input.page}:${input.limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const { ids, total } = await this.es.searchIds(
      user.id,
      input.search!,
      input.mailbox,
      input.page,
      input.limit,
    );
    if (ids.length === 0) {
      const empty = { items: [], page: input.page, limit: input.limit, total, pages: 0 };
      await this.redis.set(cacheKey, empty, 30);
      return empty;
    }

    const msgs = await this.prisma.message.findMany({ where: { id: { in: ids } } });
    const order = new Map(ids.map((id, i) => [id, i]));
    msgs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const result = {
      items: msgs.map((m) => this.toSummary(m)),
      page: input.page,
      limit: input.limit,
      total,
      pages: Math.ceil(total / input.limit),
    };
    await this.redis.set(cacheKey, result, 30);
    return result;
  }

  async getById(user: AuthUser, id: string) {
    const msg = await this.prisma.message.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }

  async create(user: AuthUser, dto: CreateMessageDto) {
    const snippet = (dto.body ?? '').replace(/<[^>]+>/g, ' ').slice(0, 160);
    const mailbox = dto.mailbox ?? Mailbox.INBOX;
    const state = mailbox === Mailbox.SENT ? MessageState.SENT : MessageState.RECEIVED;

    const created = await this.prisma.message.create({
      data: {
        ownerId: user.id,
        from: user.email,
        to: dto.to,
        subject: dto.subject ?? '',
        body: dto.body ?? '',
        snippet,
        mailbox,
        state,
        labels: dto.labels ?? [],
        isImportant: dto.isImportant ?? false,
      },
    });

    // Index for search (no-op if ES is disabled)
    await this.es.indexMessage(created);

    // Real outbound delivery for sent mail (no-op / demo mode if SMTP unset)
    if (mailbox === Mailbox.SENT) {
      const result = await this.mail.send(dto.to, dto.subject ?? '', dto.body ?? '');
      if (result.sent) {
        this.logger.log(`Delivered message ${created.id} (${result.messageId})`);
      }
    }

    await this.redis.invalidatePrefix(this.cachePrefix(user.id));
    this.logger.log(`Message ${created.id} created for ${user.email}`);
    return created;
  }

  async update(user: AuthUser, id: string, dto: UpdateMessageDto) {
    await this.getById(user, id);
    const updated = await this.prisma.message.update({
      where: { id },
      data: {
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
