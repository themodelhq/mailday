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
