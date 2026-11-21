import { InboundService } from '../src/mail/inbound.service';

const config: any = { get: (key: string) => key === 'INBOUND_WEBHOOK_TOKEN' ? 'test-token' : undefined };
const prisma: any = {};
const redis: any = { invalidatePrefix: jest.fn(async () => undefined) };
const es: any = { indexMessage: jest.fn(async () => undefined) };
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
      message: { create: jest.fn(), findFirst: jest.fn(async () => null) },
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
      message: { create: jest.fn(async () => ({ id: 'message-1' })), findFirst: jest.fn(async () => null) },
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


describe('InboundService failure recovery', () => {
  it('reclaims a FAILED receipt and processes a retry', async () => {
    const receipt = { id: 'receipt-retry' };
    const localPrisma: any = {
      user: { findFirst: jest.fn(async () => ({ id: 'user-1' })) },
      inboundReceipt: {
        create: jest.fn()
          .mockResolvedValueOnce(receipt)
          .mockRejectedValueOnce({ code: 'P2002' }),
        findUnique: jest.fn(async () => ({ id: receipt.id, status: 'FAILED', receivedAt: new Date() })),
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 }) // initial receipt claim
          .mockResolvedValueOnce({ count: 1 }) // retry claim from FAILED
          .mockResolvedValueOnce({ count: 1 }), // retry PROCESSING claim
        update: jest.fn(async () => ({})),
      },
      message: {
        findFirst: jest.fn(async () => null),
        create: jest.fn()
          .mockRejectedValueOnce(new Error('temporary database failure'))
          .mockResolvedValueOnce({ id: 'message-recovered' }),
        delete: jest.fn(async () => ({})),
      },
    };
    const localService = new InboundService(config, localPrisma, redis, es, scanner);

    const first = await localService.receive('test-token', {
      provider: 'test-provider', messageId: 'retry-id', to: 'user@mailday.app', text: 'hello',
    });
    expect(first.recipients).toEqual([{ recipient: 'user@mailday.app', status: 'FAILED' }]);
    expect(localPrisma.inboundReceipt.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: receipt.id }, data: expect.objectContaining({ status: 'FAILED' }),
    }));

    const second = await localService.receive('test-token', {
      provider: 'test-provider', messageId: 'retry-id', to: 'user@mailday.app', text: 'hello',
    });
    expect(second.recipients).toEqual([{ recipient: 'user@mailday.app', status: 'PROCESSED' }]);
    expect(localPrisma.message.create).toHaveBeenCalledTimes(2);
    expect(localPrisma.inboundReceipt.updateMany).toHaveBeenCalledTimes(3);
  });

  it('rolls back the created message if marking its receipt processed fails', async () => {
    const localPrisma: any = {
      user: { findFirst: jest.fn(async () => ({ id: 'user-1' })) },
      inboundReceipt: {
        create: jest.fn(async () => ({ id: 'receipt-rollback' })),
        updateMany: jest.fn(async () => ({ count: 1 })),
        update: jest.fn()
          .mockRejectedValueOnce(new Error('receipt persistence outage'))
          .mockResolvedValueOnce({}),
      },
      message: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: 'message-partial' })),
        delete: jest.fn(async () => ({})),
      },
    };
    const localService = new InboundService(config, localPrisma, redis, es, scanner);
    const result = await localService.receive('test-token', {
      provider: 'test-provider', messageId: 'rollback-id', to: 'user@mailday.app', text: 'hello',
    });

    expect(result.recipients).toEqual([{ recipient: 'user@mailday.app', status: 'FAILED' }]);
    expect(localPrisma.message.delete).toHaveBeenCalledWith({ where: { id: 'message-partial' } });
    expect(localPrisma.inboundReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'receipt-rollback' }, data: expect.objectContaining({ status: 'FAILED', messageId: null }),
    }));
  });

  it('rejects malware before creating receipts or messages', async () => {
    const localScanner: any = { scan: jest.fn(async () => 'INFECTED') };
    const localPrisma: any = {
      user: { findFirst: jest.fn() },
      inboundReceipt: { create: jest.fn() },
      message: { create: jest.fn() },
    };
    const localService = new InboundService(config, localPrisma, redis, es, localScanner);
    const rawMime = [
      'From: sender@example.test',
      'To: user@mailday.app',
      'Subject: infected attachment',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="mailday-boundary"',
      '',
      '--mailday-boundary',
      'Content-Type: text/plain',
      '',
      'body',
      '--mailday-boundary',
      'Content-Type: application/octet-stream',
      'Content-Disposition: attachment; filename="sample.bin"',
      'Content-Transfer-Encoding: base64',
      '',
      'Y2hlY2s=',
      '--mailday-boundary--',
      '',
    ].join('\\r\\n');

    await expect(localService.receive('test-token', { rawMime })).rejects.toThrow('malware detected');
    expect(localScanner.scan).toHaveBeenCalledTimes(1);
    expect(localPrisma.inboundReceipt.create).not.toHaveBeenCalled();
    expect(localPrisma.message.create).not.toHaveBeenCalled();
  });
});
