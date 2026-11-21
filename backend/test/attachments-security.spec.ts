import { AttachmentsService } from '../src/messages/attachments.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('AttachmentsService security and lifecycle', () => {
  let dir: string;
  const ownerId = 'owner-1';
  const messageId = 'message-1';
  let prisma: any;
  let scanner: any;
  let service: AttachmentsService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mailday-attachments-'));
    prisma = {
      message: {
        findFirst: jest.fn().mockResolvedValue({ id: messageId, ownerId }),
        update: jest.fn().mockResolvedValue({ hasAttachments: true }),
      },
      attachment: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'attachment-1', ...data })),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    scanner = { scan: jest.fn().mockResolvedValue('CLEAN') };
    service = new AttachmentsService(prisma, scanner);
    (service as any).storageDir = dir;
  });

  afterEach(async () => rm(dir, { recursive: true, force: true }));

  it('rejects attachments over 20 MB before scanning or writing', async () => {
    const file = { originalname: 'large.bin', mimetype: 'application/octet-stream', size: 20 * 1024 * 1024 + 1, buffer: Buffer.alloc(20 * 1024 * 1024 + 1) };
    await expect(service.upload(ownerId, messageId, file)).rejects.toThrow('Attachment exceeds the 20 MB limit');
    expect(scanner.scan).not.toHaveBeenCalled();
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it('rejects infected files before persisting', async () => {
    scanner.scan.mockResolvedValue('INFECTED');
    const file = { originalname: 'bad.txt', mimetype: 'text/plain', size: 3, buffer: Buffer.from('bad') };
    await expect(service.upload(ownerId, messageId, file)).rejects.toThrow('malware detected');
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it('stores UUID-backed file and metadata for clean upload', async () => {
    const file = { originalname: '../report.txt', mimetype: 'text/plain', size: 4, buffer: Buffer.from('test') };
    const result = await service.upload(ownerId, messageId, file);
    expect(result.storageName).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.originalName).toBe('report.txt');
    expect(result.scanStatus).toBe('CLEAN');
    expect(await readFile(join(dir, result.storageName))).toEqual(file.buffer);
    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: messageId }, data: { hasAttachments: true } });
  });

  it('cleans the file if database persistence fails', async () => {
    prisma.attachment.create.mockRejectedValue(new Error('database failure'));
    const file = { originalname: 'file.txt', mimetype: 'text/plain', size: 3, buffer: Buffer.from('abc') };
    await expect(service.upload(ownerId, messageId, file)).rejects.toThrow('database failure');
    expect(await (await import('fs/promises')).readdir(dir)).toEqual([]);
  });

  it('rejects unsafe stored path references before file access', async () => {
    prisma.attachment.findFirst.mockResolvedValue({ id: 'attachment-1', storageName: '../secret', scanStatus: 'CLEAN' });
    await expect(service.download(ownerId, 'attachment-1')).rejects.toThrow('Invalid attachment storage reference');
  });

  it('rejects downloads of infected attachments', async () => {
    prisma.attachment.findFirst.mockResolvedValue({ id: 'attachment-1', storageName: '00000000-0000-0000-0000-000000000001', scanStatus: 'INFECTED' });
    await expect(service.download(ownerId, 'attachment-1')).rejects.toThrow('flagged as malware');
  });

  it('does not access foreign-owned attachments', async () => {
    prisma.attachment.findFirst.mockResolvedValue(null);
    await expect(service.download('other-owner', 'attachment-1')).rejects.toThrow('Attachment not found');
  });
});
