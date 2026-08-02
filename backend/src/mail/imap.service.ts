import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { ImapAccount, Mailbox, MessageState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../search/elasticsearch.service';
import { CryptoService } from '../common/crypto.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

// mailparser's from/to can be a single AddressObject or an array of them.
function extractAddresses(field: unknown): string[] {
  if (!field) return [];
  const list = Array.isArray(field) ? field : [field];
  const result: string[] = [];
  for (const item of list as Array<{ value?: Array<{ address?: string }> }>) {
    for (const v of item?.value ?? []) {
      if (v?.address) result.push(v.address);
    }
  }
  return result;
}

export interface SafeAccount {
  id: string;
  host: string;
  port: number;
  username: string;
  secure: boolean;
  lastError: string | null;
  createdAt: Date;
}

/**
 * Inbound mail receive path. Each user can connect an IMAP account; this service
 * polls those accounts on an interval, parses new messages, and imports them into
 * the user's MailDay inbox. IMAP passwords are encrypted at rest (CryptoService).
 * No-op when no accounts exist; the global IMAP_* env can seed a demo account.
 */
@Injectable()
export class ImapService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Imap');
  private timer?: NodeJS.Timeout;
  private polling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly es: ElasticsearchService,
    private readonly crypto: CryptoService,
  ) {}

  async onModuleInit() {
    await this.seedDemoAccount().catch(() => undefined);
    const seconds = parseInt(process.env.IMAP_POLL_SECONDS ?? '60', 10) || 60;
    this.timer = setInterval(() => void this.pollAll(), seconds * 1000);
    this.logger.log(`IMAP poller scheduled every ${seconds}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private toSafe(a: ImapAccount): SafeAccount {
    return {
      id: a.id,
      host: a.host,
      port: a.port,
      username: a.username,
      secure: a.secure,
      lastError: a.lastError,
      createdAt: a.createdAt,
    };
  }

  async connectAccount(user: AuthUser, dto: { host: string; port?: number; username: string; password: string; secure?: boolean }) {
    const account = await this.prisma.imapAccount.create({
      data: {
        userId: user.id,
        host: dto.host,
        port: dto.port ?? 993,
        username: dto.username,
        passwordEnc: this.crypto.encrypt(dto.password),
        secure: dto.secure ?? true,
      },
    });
    // Best-effort immediate sync
    void this.pollAccount(account);
    return this.toSafe(account);
  }

  async listAccounts(user: AuthUser): Promise<SafeAccount[]> {
    const accounts = await this.prisma.imapAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return accounts.map((a) => this.toSafe(a));
  }

  async removeAccount(user: AuthUser, id: string) {
    const existing = await this.prisma.imapAccount.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new NotFoundException('Account not found');
    await this.prisma.imapAccount.delete({ where: { id } });
    return { success: true };
  }

  async syncAccount(user: AuthUser, id: string) {
    const account = await this.prisma.imapAccount.findFirst({ where: { id, userId: user.id } });
    if (!account) throw new NotFoundException('Account not found');
    await this.pollAccount(account);
    return this.toSafe(account);
  }

  private async seedDemoAccount() {
    const host = process.env.IMAP_HOST;
    if (!host) return;
    const demo = await this.prisma.user.findUnique({ where: { email: 'demo@mailday.app' } });
    if (!demo) return;
    const existing = await this.prisma.imapAccount.findFirst({
      where: { userId: demo.id, host },
    });
    if (existing) return;
    await this.prisma.imapAccount.create({
      data: {
        userId: demo.id,
        host,
        port: parseInt(process.env.IMAP_PORT ?? '993', 10),
        username: process.env.IMAP_USER ?? '',
        passwordEnc: this.crypto.encrypt(process.env.IMAP_PASS ?? ''),
        secure: (process.env.IMAP_SECURE ?? 'true') === 'true',
      },
    });
    this.logger.log('Seeded demo IMAP account');
  }

  async pollAll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const accounts = await this.prisma.imapAccount.findMany();
      for (const account of accounts) {
        await this.pollAccount(account).catch((e) =>
          this.logger.warn(`poll ${account.host} failed: ${(e as Error).message}`),
        );
      }
    } catch (e) {
      // Never let a poll-cycle failure (DB down, migrations not applied, etc.)
      // escape as an unhandled rejection — that crashes the whole Node process.
      this.logger.error(`IMAP poll cycle failed: ${(e as Error)?.message}`);
    } finally {
      this.polling = false;
    }
  }

  private async pollAccount(account: ImapAccount) {
    const password = this.crypto.decrypt(account.passwordEnc);
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: { user: account.username, pass: password },
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = (await client.search({ seen: false }, { uid: true })) as number[];
        for (const uid of uids) {
          const msg = await client.fetchOne(uid, { uid: true, source: true });
          if (!msg || !msg.source) continue;
          const parsed = await simpleParser(msg.source as Buffer);
          await this.importMessage(account.userId, parsed);
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        }
      } finally {
        lock.release();
      }
      await client.logout();
      if (account.lastError) {
        await this.prisma.imapAccount.update({
          where: { id: account.id },
          data: { lastError: null },
        });
      }
    } catch (e) {
      const message = (e as Error).message;
      await this.prisma.imapAccount
        .update({ where: { id: account.id }, data: { lastError: message.slice(0, 200) } })
        .catch(() => undefined);
      throw e;
    }
  }

  private async importMessage(userId: string, parsed: ParsedMail) {
    const messageId = parsed.messageId;
    const labelMid = messageId ? `mid:${messageId}` : '';
    if (labelMid) {
      const dup = await this.prisma.message.count({
        where: { ownerId: userId, labels: { has: labelMid } },
      });
      if (dup > 0) return; // already imported
    }

    const fromList = extractAddresses(parsed.from);
    const fromAddress = fromList[0] ?? 'unknown@unknown';
    const toAddresses = extractAddresses(parsed.to);
    const subject = parsed.subject ?? '';
    const body: string =
      (parsed.html as string) || (parsed.text as string) || (parsed.textAsHtml as string) || '';
    const textForSnippet = parsed.text ?? '';
    const snippet = textForSnippet.replace(/\s+/g, ' ').slice(0, 160);

    const created = await this.prisma.message.create({
      data: {
        ownerId: userId,
        from: fromAddress,
        to: toAddresses.length ? toAddresses : ['me@mailday.app'],
        subject,
        body,
        snippet,
        mailbox: Mailbox.INBOX,
        state: MessageState.RECEIVED,
        labels: labelMid ? ['IMAP', labelMid] : ['IMAP'],
      },
    });

    await this.es.indexMessage(created);
    await this.redis.invalidatePrefix(`messages:${userId}:`);
    this.logger.log(`Imported message ${created.id} for ${userId}`);
  }
}
