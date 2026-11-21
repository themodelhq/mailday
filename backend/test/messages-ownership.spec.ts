import { MessagesService } from '../src/messages/messages.service';

describe('MessagesService ownership isolation', () => {
  const user = { id: 'owner-1', email: 'owner@example.test' } as any;
  const redis: any = { get: jest.fn(), set: jest.fn(), invalidatePrefix: jest.fn() };
  const es: any = { enabled: false, removeMessage: jest.fn(), updateMessage: jest.fn() };
  const mail: any = { enabled: true };

  it('returns not found for a message owned by another user', async () => {
    const prisma: any = { message: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new MessagesService(prisma, redis, es, mail);
    await expect(service.getById(user, 'foreign-message')).rejects.toThrow('Message not found');
    expect(prisma.message.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-message', ownerId: user.id } });
  });

  it('does not update a foreign-owned message', async () => {
    const prisma: any = { message: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() } };
    const service = new MessagesService(prisma, redis, es, mail);
    await expect(service.update(user, 'foreign-message', { subject: 'changed' } as any)).rejects.toThrow('Message not found');
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('does not delete a foreign-owned message or touch its attachments', async () => {
    const prisma: any = { message: { findFirst: jest.fn().mockResolvedValue(null), delete: jest.fn() }, attachment: { findMany: jest.fn() } };
    const service = new MessagesService(prisma, redis, es, mail);
    await expect(service.remove(user, 'foreign-message')).rejects.toThrow('Message not found');
    expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    expect(prisma.message.delete).not.toHaveBeenCalled();
    expect(es.removeMessage).not.toHaveBeenCalled();
  });

  it('only retrieves threads belonging to the requesting owner', async () => {
    const prisma: any = { message: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new MessagesService(prisma, redis, es, mail);
    await service.getThread(user, 'shared-thread-id');
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { ownerId: user.id, threadId: 'shared-thread-id' },
      orderBy: { sentAt: 'asc' },
    });
  });

  it('does not expose delivery status for another owner', async () => {
    const prisma: any = { outboundDelivery: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new MessagesService(prisma, redis, es, mail);
    await expect(service.getDeliveryStatus(user, 'foreign-message')).rejects.toThrow('Outbound delivery not found');
    expect(prisma.outboundDelivery.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { messageId: 'foreign-message', ownerId: user.id },
    }));
  });

  it('does not retry a delivery owned by another user', async () => {
    const prisma: any = { outboundDelivery: { findFirst: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn() };
    const service = new MessagesService(prisma, redis, es, mail);
    await expect(service.retryDelivery(user, 'foreign-message')).rejects.toThrow('Outbound delivery not found');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
