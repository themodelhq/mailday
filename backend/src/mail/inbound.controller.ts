import { Controller, Post, Headers, Body, Req, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InboundService } from './inbound.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('mail/inbound')
export class InboundController {
  private readonly logger = new Logger('InboundWebhook');
  constructor(private readonly inbound: InboundService, private readonly config: ConfigService) {}

  @Post('webhook')
  receive(@Headers('x-mailday-inbound-token') token: string | undefined, @Body() body: any) {
    return this.inbound.receive(token, body);
  }

  /** Resend's email.received webhook carries metadata; MailDay fetches full content via HTTPS. */
  @Post('resend')
  async receiveResend(@Req() req: RawBodyRequest, @Body() body: any) {
    this.verifyResendSignature(req, body);
    if (body?.type !== 'email.received' || !body?.data?.email_id) {
      return { accepted: true, ignored: true, reason: 'Unsupported Resend event' };
    }
    const apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
    const internalToken = this.config.get<string>('INBOUND_WEBHOOK_TOKEN') ?? '';
    if (!apiKey || !internalToken) throw new UnauthorizedException('Resend receiving is not configured');
    const emailId = String(body.data.email_id);
    const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      this.logger.error(`Resend receiving API fetch failed: HTTP ${response.status}`);
      throw new BadRequestException('Could not retrieve inbound email from Resend');
    }
    const email = await response.json() as { id?: string; from?: string; to?: string | string[]; subject?: string; text?: string; html?: string };
    const result = await this.inbound.receive(internalToken, {
      provider: 'resend',
      messageId: email.id ?? emailId,
      from: email.from ?? body.data.from,
      to: email.to ?? body.data.to,
      subject: email.subject ?? body.data.subject,
      text: email.text,
      html: email.html,
    });
    return { accepted: true, provider: 'resend', result };
  }

  private verifyResendSignature(req: RawBodyRequest, body: unknown) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET') ?? '';
    if (!secret) throw new UnauthorizedException('Resend webhook secret is not configured');
    const raw = req.rawBody;
    const id = req.header('svix-id');
    const timestamp = req.header('svix-timestamp');
    const signature = req.header('svix-signature');
    if (!raw || !id || !timestamp || !signature) throw new UnauthorizedException('Missing Resend webhook signature headers');
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) throw new UnauthorizedException('Resend webhook timestamp expired');
    const secretValue = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    let key: Buffer;
    try { key = Buffer.from(secretValue, 'base64'); } catch { throw new UnauthorizedException('Invalid Resend webhook secret'); }
    const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(raw).digest('base64');
    const candidates = signature.split(' ').map(v => v.split(',')).filter(v => v[0] === 'v1').map(v => v[1]);
    const expectedBuffer = Buffer.from(expected);
    const valid = candidates.some(candidate => {
      const supplied = Buffer.from(candidate ?? '');
      return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
    });
    if (!valid) throw new UnauthorizedException('Invalid Resend webhook signature');
  }
}
