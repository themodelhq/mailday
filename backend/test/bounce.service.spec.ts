import { BounceService } from '../src/mail/bounce.service';

const config: any = { get: (key: string) => key === 'DELIVERY_BOUNCE_WEBHOOK_TOKEN' ? 'secret-token' : undefined };

describe('BounceService', () => {
  it('rejects missing or invalid webhook tokens', async () => {
    const service = new BounceService({} as any, config);
    await expect(service.receive(undefined, {} as any)).rejects.toThrow('Bounce webhook is not configured');
    await expect(service.receive('wrong', {} as any)).rejects.toThrow('Invalid bounce webhook token');
  });

  it('returns duplicate for a previously recorded provider event', async () => {
    const prisma: any = {
      outboundDeliveryEvent: { findFirst: jest.fn(async () => ({ id: 'event-1' })) },
    };
    const service = new BounceService(prisma, config);
    const result = await service.receive('secret-token', {
      provider: 'test', eventId: 'evt-1', messageId: 'smtp-id', recipient: 'recipient@example.test',
    });
    expect(result).toEqual({ status: 'DUPLICATE' });
  });

  it('rejects bounce events for recipients not on the original message', async () => {
    const prisma: any = {
      outboundDeliveryEvent: { findFirst: jest.fn(async () => null) },
      outboundDelivery: { findFirst: jest.fn(async () => ({
        id: 'delivery-1', messageId: 'message-1', status: 'SENT', message: { to: ['expected@example.test'], cc: [], bcc: [] },
      })) },
    };
    const service = new BounceService(prisma, config);
    await expect(service.receive('secret-token', {
      provider: 'test', eventId: 'evt-2', messageId: 'smtp-id', recipient: 'attacker@example.test',
    })).rejects.toThrow('Bounce recipient does not match delivery recipients');
  });

  it('records the bounce event and marks delivery/message failed', async () => {
    const delivery = { id: 'delivery-1', messageId: 'message-1', status: 'SENT', message: { to: ['recipient@example.test'], cc: [], bcc: [] } };
    const tx: any = {
      outboundDeliveryEvent: { create: jest.fn(async () => ({ id: 'event-1' })) },
      outboundDelivery: { update: jest.fn(async () => ({ status: 'BOUNCED' })) },
      message: { update: jest.fn(async () => ({ state: 'FAILED' })) },
    };
    const prisma: any = {
      outboundDeliveryEvent: { findFirst: jest.fn(async () => null) },
      outboundDelivery: { findFirst: jest.fn(async () => delivery) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = new BounceService(prisma, config);
    const result = await service.receive('secret-token', {
      provider: 'test-provider', eventId: 'evt-3', messageId: 'smtp-id', recipient: 'recipient@example.test',
      reason: 'Mailbox unavailable', bouncedAt: '2026-11-21T12:00:00.000Z',
    });
    expect(result).toEqual({ status: 'BOUNCED', deliveryId: 'delivery-1' });
    expect(tx.outboundDeliveryEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'BOUNCED', providerEventId: 'evt-3', recipient: 'recipient@example.test' }),
    }));
    expect(tx.outboundDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'delivery-1' }, data: expect.objectContaining({ status: 'BOUNCED', lastError: 'Mailbox unavailable' }),
    }));
    expect(tx.message.update).toHaveBeenCalledWith({ where: { id: 'message-1' }, data: { state: 'FAILED' } });
  });
});

describe('BounceService payload validation', () => {
  const prisma: any = {};
  const service = new BounceService(prisma, config);

  it('rejects malformed recipient addresses', async () => {
    await expect(service.receive('secret-token', {
      provider: 'test', eventId: 'evt', messageId: 'smtp-id', recipient: 'not-an-email',
    })).rejects.toThrow('recipient must be a valid email address');
  });

  it('rejects oversized provider/event/message/recipient fields', async () => {
    await expect(service.receive('secret-token', {
      provider: 'x'.repeat(257), eventId: 'evt', messageId: 'smtp-id', recipient: 'a@example.test',
    })).rejects.toThrow('provider exceeds 256 characters');
    await expect(service.receive('secret-token', {
      provider: 'test', eventId: 'x'.repeat(256), messageId: 'smtp-id', recipient: 'a@example.test',
    })).rejects.toThrow('eventId exceeds 255 characters');
    await expect(service.receive('secret-token', {
      provider: 'test', eventId: 'evt', messageId: 'x'.repeat(501), recipient: 'a@example.test',
    })).rejects.toThrow('messageId exceeds 500 characters');
    await expect(service.receive('secret-token', {
      provider: 'test', eventId: 'evt', messageId: 'smtp-id', recipient: 'x'.repeat(321),
    })).rejects.toThrow('recipient exceeds 320 characters');
  });

  it('rejects invalid bouncedAt timestamps', async () => {
    await expect(service.receive('secret-token', {
      provider: 'test', eventId: 'evt', messageId: 'smtp-id', recipient: 'a@example.test', bouncedAt: 'invalid',
    })).rejects.toThrow('bouncedAt must be a valid timestamp');
  });
});
