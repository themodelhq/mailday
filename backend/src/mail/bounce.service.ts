import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface BouncePayload {
  provider: string;
  eventId: string;
  messageId: string;
  recipient: string;
  reason?: string;
  bouncedAt?: string;
}

@Injectable()
export class BounceService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private authorize(token?: string) {
    const expected = this.config.get<string>('DELIVERY_BOUNCE_WEBHOOK_TOKEN');
    if (!expected || !token) throw new UnauthorizedException('Bounce webhook is not configured or unauthorized');
    const supplied = Buffer.from(token);
    const configured = Buffer.from(expected);
    if (supplied.length !== configured.length || !timingSafeEqual(supplied, configured)) {
      throw new UnauthorizedException('Invalid bounce webhook token');
    }
  }

  async receive(token: string | undefined, payload: BouncePayload) {
    this.authorize(token);
    if (!payload || typeof payload !== 'object') throw new BadRequestException('Invalid bounce payload');
    for (const field of ['provider', 'eventId', 'messageId', 'recipient'] as const) {
      if (typeof payload[field] !== 'string' || !payload[field].trim()) throw new BadRequestException(`${field} is required`);
    }
    if (payload.reason !== undefined && typeof payload.reason !== 'string') throw new BadRequestException('reason must be a string');
    if (payload.reason && payload.reason.length > 2000) throw new BadRequestException('reason exceeds 2000 characters');
    if (payload.bouncedAt !== undefined && typeof payload.bouncedAt !== 'string') throw new BadRequestException('bouncedAt must be a string');
    const provider = payload.provider.trim().slice(0, 100);
    const eventId = payload.eventId.trim().slice(0, 255);
    const messageId = payload.messageId.trim();
    const recipient = payload.recipient.trim().toLowerCase();

    const duplicate = await this.prisma.outboundDeliveryEvent.findFirst({
      where: { provider, providerEventId: eventId },
      select: { id: true },
    });
    if (duplicate) return { status: 'DUPLICATE' };

    const delivery = await this.prisma.outboundDelivery.findFirst({
      where: { providerMessageId: messageId },
      include: { message: true },
    });
    if (!delivery) throw new NotFoundException('Outbound delivery not found for provider message ID');
    if (!['SENT', 'BOUNCED'].includes(delivery.status)) throw new BadRequestException('Bounce events can only be applied to sent deliveries');

    const recipients = [...delivery.message.to, ...delivery.message.cc, ...delivery.message.bcc]
      .map((address) => address.trim().toLowerCase());
    if (!recipients.includes(recipient)) throw new BadRequestException('Bounce recipient does not match delivery recipients');

    const occurredAt = payload.bouncedAt && !Number.isNaN(Date.parse(payload.bouncedAt))
      ? new Date(payload.bouncedAt) : new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.outboundDeliveryEvent.create({
          data: {
            deliveryId: delivery.id, eventType: 'BOUNCED', provider, providerEventId: eventId,
            recipient, detail: payload.reason?.trim().slice(0, 2000) || null, occurredAt,
          },
        });
        await tx.outboundDelivery.update({
          where: { id: delivery.id },
          data: { status: 'BOUNCED', lastError: payload.reason?.trim().slice(0, 2000) || 'Message bounced', failedAt: occurredAt, lockedAt: null },
        });
        await tx.message.update({ where: { id: delivery.messageId }, data: { state: 'FAILED' } });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return { status: 'DUPLICATE' };
      throw error;
    }
    return { status: 'BOUNCED', deliveryId: delivery.id };
  }
}
