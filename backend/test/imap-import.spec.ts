import { ImapService } from '../src/mail/imap.service';

describe('IMAP message import deduplication', () => {
  const prisma: any = {
    message: {
      count: jest.fn(async () => 0),
      create: jest.fn(async (args) => ({ id: 'message-1', ...args.data })),
    },
  };
  const redis: any = { invalidatePrefix: jest.fn(async () => undefined) };
  const es: any = { indexMessage: jest.fn(async () => undefined) };
  const crypto: any = { decrypt: jest.fn(), encrypt: jest.fn() };
  let service: ImapService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.message.count.mockResolvedValue(0);
    prisma.message.create.mockImplementation(async (args: any) => ({ id: 'message-1', ...args.data }));
    service = new ImapService(prisma, redis, es, crypto);
  });

  it('uses an IMAP-scoped message-id dedup label', async () => {
    const parsed: any = {
      messageId: '<unique@example.test>',
      from: { value: [{ address: 'sender@example.test' }] },
      to: { value: [{ address: 'recipient@example.test' }] },
      subject: 'Hello',
      text: 'Hello world',
    };

    await (service as any).importMessage('user-1', parsed, Buffer.from('raw email'));

    expect(prisma.message.count).toHaveBeenCalledWith({
      where: { ownerId: 'user-1', labels: { has: 'mid:imap:<unique@example.test>' } },
    });
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        labels: ['IMAP', 'mid:imap:<unique@example.test>'],
        snippet: 'Hello world',
      }),
    }));
  });

  it('uses a content hash when Message-ID is absent', async () => {
    const source = Buffer.from('raw email without message-id');
    const parsed: any = {
      from: { value: [{ address: 'sender@example.test' }] },
      to: { value: [{ address: 'recipient@example.test' }] },
      subject: 'Fallback',
      text: 'Fallback content',
    };

    await (service as any).importMessage('user-1', parsed, source);

    const crypto = require('crypto');
    const expected = crypto.createHash('sha256').update(source).digest('hex');
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ labels: ['IMAP', `imap-sha256:${expected}`] }),
    }));
  });
});
