import { MessagesService } from '../src/messages/messages.service';

describe('MessagesService manual delivery retry', () => {
  const user: any = { id: 'user-1', email: 'user@example.test' };
  const redis: any = { invalidatePrefix: jest.fn(async () => undefined) };
  const es: any = { enabled: false };
  const mail: any = { enabled: true };

  it('resets a failed delivery and queues its message atomically', async () => {
    const failed = { id: 'delivery-1', ownerId: user.id, messageId: 'message-1', status: 'FAILED', attempts: 8 };
    const queued = { ...failed, status: 'QUEUED', attempts: 0, lastError: null, failedAt: null };
    const tx: any = {
      outboundDelivery: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        findUnique: jest.fn(async () => queued),
      },
      message: { update: jest.fn(async () => ({ id: 'message-1', state: 'QUEUED' })) },
    };
    const prisma: any = {
      outboundDelivery: { findFirst: jest.fn(async () => failed) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = new MessagesService(prisma, redis, es, mail);

    const result = await service.retryDelivery(user, 'message-1');

    expect(prisma.outboundDelivery.findFirst).toHaveBeenCalledWith({ where: { messageId: 'message-1', ownerId: 'user-1' } });
    expect(tx.outboundDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'delivery-1', ownerId: 'user-1', status: 'FAILED' },
      data: expect.objectContaining({ status: 'QUEUED', attempts: 0, lastError: null, failedAt: null }),
    }));
    expect(tx.message.update).toHaveBeenCalledWith({ where: { id: 'message-1' }, data: { state: 'QUEUED' } });
    expect(result).toEqual(queued);
    expect(redis.invalidatePrefix).toHaveBeenCalledWith('messages:user-1:');
  });

  it('rejects retrying a delivery that is not failed', async () => {
    const prisma: any = {
      outboundDelivery: { findFirst: jest.fn(async () => ({ id: 'delivery-1', status: 'SENT' })) },
    };
    const service = new MessagesService(prisma, redis, es, mail);
    await expect(service.retryDelivery(user, 'message-1')).rejects.toThrow('Only failed deliveries can be retried manually');
  });

  it('rejects retry if the failed-delivery claim lost a race', async () => {
    const prisma: any = {
      outboundDelivery: { findFirst: jest.fn(async () => ({ id: 'delivery-1', status: 'FAILED' })) },
      $transaction: jest.fn(async (callback: any) => callback({
        outboundDelivery: { updateMany: jest.fn(async () => ({ count: 0 })) },
        message: { update: jest.fn() },
      })),
    };
    const service = new MessagesService(prisma, redis, es, mail);
    await expect(service.retryDelivery(user, 'message-1')).rejects.toThrow('Delivery is no longer eligible for retry');
  });

  it('does not retry when outbound SMTP is unavailable', async () => {
    const service = new MessagesService({} as any, redis, es, { enabled: false } as any);
    await expect(service.retryDelivery(user, 'message-1')).rejects.toThrow('Outbound email is not configured');
  });
});
