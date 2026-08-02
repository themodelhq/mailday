import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Real SMTP delivery via Nodemailer. When SMTP_HOST is unset the service runs
 * in "demo mode": messages are stored in the user's mailbox but not delivered
 * externally. Configure SMTP_* env vars to enable actual outbound email.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: nodemailer.Transporter | null = null;
  readonly enabled: boolean;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('MAIL_FROM') ?? 'noreply@mailday.app';
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(config.get<string>('SMTP_PORT') ?? '587', 10),
        secure: (config.get<string>('SMTP_SECURE') ?? 'false') === 'true',
        auth: config.get<string>('SMTP_USER')
          ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') }
          : undefined,
      });
      this.enabled = true;
      this.logger.log(`SMTP enabled (${host})`);
    } else {
      this.enabled = false;
    }
  }

  async verify(): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      return await this.transporter.verify();
    } catch {
      return false;
    }
  }

  async send(to: string[], subject: string, html: string): Promise<SendResult> {
    if (!this.transporter) {
      this.logger.debug('SMTP not configured — message stored locally (demo mode).');
      return { sent: false, error: 'SMTP_NOT_CONFIGURED' };
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
      return { sent: true, messageId: info.messageId };
    } catch (e) {
      this.logger.error(`SMTP send failed: ${(e as Error).message}`);
      return { sent: false, error: (e as Error).message };
    }
  }
}
