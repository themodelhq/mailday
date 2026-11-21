import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { basename, join } from 'path';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { AttachmentScanner } from './attachment-scanner.service';

export interface AttachmentUploadFile { originalname: string; mimetype: string; size: number; buffer: Buffer; }

@Injectable()
export class AttachmentsService {
  private readonly storageDir = process.env.ATTACHMENTS_DIR || join(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService, private scanner: AttachmentScanner) {}

  private safeStoragePath(storageName: string) {
    // Storage keys are generated UUIDs, never user-controlled paths.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storageName)) {
      throw new BadRequestException('Invalid attachment storage reference');
    }
    return join(this.storageDir, storageName);
  }

  async upload(ownerId: string, messageId: string, file: AttachmentUploadFile) {
    const message = await this.prisma.message.findFirst({ where: { id: messageId, ownerId } });
    if (!message) throw new NotFoundException('Message not found');
    if (!file || !Buffer.isBuffer(file.buffer)) throw new BadRequestException('No file uploaded');
    if (file.buffer.length > 20 * 1024 * 1024) throw new BadRequestException('Attachment exceeds the 20 MB limit');

    const scanStatus = await this.scanner.scan(file.buffer);
    if (scanStatus === 'INFECTED') throw new BadRequestException('Attachment rejected: malware detected');

    const storageName = randomUUID();
    const safeOriginalName = basename(file.originalname || 'attachment')
      .replace(/[\u0000-\u001f\u007f]/g, '_')
      .slice(0, 255) || 'attachment';
    const mimeParts = (file.mimetype || '').split('/');
    const safeMimeType = mimeParts.length === 2 && mimeParts.every((part) => /^[a-z0-9!#$&^_.+-]+$/i.test(part))
      ? file.mimetype
      : 'application/octet-stream';

    await mkdir(this.storageDir, { recursive: true });
    const storagePath = this.safeStoragePath(storageName);
    await writeFile(storagePath, file.buffer, { flag: 'wx' });
    try {
      const attachment = await this.prisma.attachment.create({ data: {
        messageId,
        originalName: safeOriginalName,
        storageName,
        mimeType: safeMimeType,
        size: file.buffer.length,
        scanStatus,
      }});
      await this.prisma.message.update({ where: { id: messageId }, data: { hasAttachments: true } });
      return attachment;
    } catch (error) {
      await unlink(storagePath).catch(() => undefined);
      throw error;
    }
  }

  async list(ownerId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({ where: { id: messageId, ownerId } });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.attachment.findMany({ where: { messageId }, orderBy: { createdAt: 'asc' }, select: { id: true, originalName: true, mimeType: true, size: true, scanStatus: true, createdAt: true } });
  }

  async download(ownerId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id: attachmentId, message: { ownerId } } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.scanStatus === 'INFECTED') throw new BadRequestException('This attachment was flagged as malware and cannot be downloaded');
    const data = await readFile(this.safeStoragePath(attachment.storageName));
    return { attachment, data };
  }

  async remove(ownerId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id: attachmentId, message: { ownerId } } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await unlink(this.safeStoragePath(attachment.storageName)).catch(() => undefined);
    const remaining = await this.prisma.attachment.count({ where: { messageId: attachment.messageId } });
    if (!remaining) await this.prisma.message.update({ where: { id: attachment.messageId }, data: { hasAttachments: false } });
    return { success: true };
  }
}
