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

  async upload(ownerId: string, messageId: string, file: AttachmentUploadFile) {
    const message = await this.prisma.message.findFirst({ where: { id: messageId, ownerId } });
    if (!message) throw new NotFoundException('Message not found');
    if (!file || !file.buffer) throw new BadRequestException('No file uploaded');

    const scanStatus = await this.scanner.scan(file.buffer);
    if (scanStatus === 'INFECTED') throw new BadRequestException('Attachment rejected: malware detected');

    const storageName = randomUUID();
    const safeOriginalName = basename(file.originalname || 'attachment')
      .replace(/[\\u0000-\\u001f\\u007f]/g, '_')
      .slice(0, 255) || 'attachment';
    const mimeParts = (file.mimetype || '').split('/');
    const safeMimeType = mimeParts.length === 2 && mimeParts.every((part) => /^[a-z0-9!#    const safeMimeType = /^[a-z0-9!#$&^_.+-]+\\/[a-z0-9!#$&^_.+-]+$/i.test(file.mimetype || '')
      ? file.mimetype
      : 'application/octet-stream';^_.+-]+$/i.test(part))
      ? file.mimetype
      : 'application/octet-stream';

    await mkdir(this.storageDir, { recursive: true });
    await writeFile(join(this.storageDir, storageName), file.buffer, { flag: 'wx' });
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
      await unlink(join(this.storageDir, storageName)).catch(() => undefined);
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
    const data = await readFile(join(this.storageDir, attachment.storageName));
    return { attachment, data };
  }

  async remove(ownerId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id: attachmentId, message: { ownerId } } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await unlink(join(this.storageDir, attachment.storageName)).catch(() => undefined);
    const remaining = await this.prisma.attachment.count({ where: { messageId: attachment.messageId } });
    if (!remaining) await this.prisma.message.update({ where: { id: attachment.messageId }, data: { hasAttachments: false } });
    return { success: true };
  }
}
