import { InboundService } from '../src/mail/inbound.service';

const config: any = { get: (key: string) => key === 'INBOUND_WEBHOOK_TOKEN' ? 'test-token' : undefined };
const prisma: any = {};
const redis: any = {};
const es: any = {};
const scanner: any = { scan: jest.fn(async () => 'UNCHECKED') };

describe('InboundService request validation', () => {
  let service: InboundService;

  beforeEach(() => {
    service = new InboundService(config, prisma, redis, es, scanner);
  });

  it('does not process a duplicate while another request owns the receipt', async () => {
    const recent = new Date();
    const localPrisma: any = {
      user: { findFirst: jest.fn(async () => ({ id: 'user-1' })) },
      inboundReceipt: {
        create: jest.fn(async () => { throw { code: 'P2002' }; }),
        findUnique: jest.fn(async () => ({ id: 'receipt-1', status: 'PROCESSING', receivedAt: recent })),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      message: { create: jest.fn() },
    };
    const localService = new InboundService(config, localPrisma, redis, es, scanner);
    const result = await localService.receive('test-token', {
      provider: 'test-provider', messageId: 'duplicate-id', to: 'user@mailday.app', text: 'hello',
    });
    expect(result.recipients).toEqual([{ recipient: 'user@mailday.app', status: 'IN_PROGRESS' }]);
    expect(localPrisma.message.create).not.toHaveBeenCalled();
  });

  it('recovers a stale processing receipt and atomically claims it', async () => {
    const stale = new Date(Date.now() - 20 * 60 * 1000);
    const localPrisma: any = {
      user: { findFirst: jest.fn(async () => ({ id: 'user-1' })) },
      inboundReceipt: {
        create: jest.fn(async () => { throw { code: 'P2002' }; }),
        findUnique: jest.fn(async () => ({ id: 'receipt-1', status: 'PROCESSING', receivedAt: stale })),
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
        update: jest.fn(async () => ({})),
      },
      message: { create: jest.fn(async () => ({ id: 'message-1' })) },
      attachment: { create: jest.fn() },
    };
    const localService = new InboundService(config, localPrisma, redis, es, scanner);
    const result = await localService.receive('test-token', {
      provider: 'test-provider', messageId: 'stale-id', to: 'user@mailday.app', text: 'hello',
    });
    expect(localPrisma.inboundReceipt.updateMany).toHaveBeenCalledTimes(2);
    expect(result.recipients[0].status).toBe('PROCESSED');
  });

  it('rejects requests without a valid inbound token', async () => {
    await expect(service.receive(undefined, { to: 'user@mailday.app' })).rejects.toThrow('Inbound webhook is not configured or unauthorized');
    await expect(service.receive('wrong-token', { to: 'user@mailday.app' })).rejects.toThrow('Invalid inbound webhook token');
  });

  it('rejects MIME that does not contain a routable recipient', async () => {
    await expect(service.receive('test-token', { rawMime: 'not-valid-mime' })).rejects.toThrow('No recipient address found');
  });

  it('rejects MIME payloads over the configured 5 MB limit', async () => {
    const rawMime = 'x'.repeat(5 * 1024 * 1024 + 1);
    await expect(service.receive('test-token', { rawMime, to: 'user@mailday.app' })).rejects.toThrow('Inbound MIME payload exceeds 5 MB limit');
  });

  it('rejects more than 50 recipients before database processing', async () => {
    const recipients = Array.from({ length: 51 }, (_, i) => `user${i}@mailday.app`);
    await expect(service.receive('test-token', { to: recipients })).rejects.toThrow('Inbound message exceeds the 50-recipient limit');
  });

  it('validates payload types and recipient shape', async () => {
    await expect(service.receive('test-token', { provider: 42 as any })).rejects.toThrow('provider must be a string');
    await expect(service.receive('test-token', { to: [ 'valid@mailday.app', 42 as any] })).rejects.toThrow('to array must contain only strings');
  });
});
