import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface SendResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
}

export function classifySendError(error: unknown): { errorCode?: string; retryable: boolean } {
  const err = error as { code?: string; responseCode?: number } | null;
  const responseCode = Number(err?.responseCode);
  const errorCode = err?.code;
  if (Number.isFinite(responseCode) && responseCode >= 500) return { errorCode: String(responseCode), retryable: false };
  if (Number.isFinite(responseCode) && responseCode >= 400) return { errorCode: String(responseCode), retryable: true };
  if (errorCode && ['EAUTH', 'EENVELOPE', 'EMESSAGE'].includes(errorCode)) return { errorCode, retryable: false };
  return { errorCode, retryable: true };
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

  async send(to: string[], subject: string, html: string, cc: string[] = [], bcc: string[] = [], attachments: { storageName: string; originalName: string; mimeType: string }[] = []): Promise<SendResult> {
    if (!this.transporter) {
      this.logger.debug('SMTP not configured — message stored locally (demo mode).');
      return { sent: false, error: 'SMTP_NOT_CONFIGURED', errorCode: 'SMTP_NOT_CONFIGURED', retryable: false };
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject,
        html,
        attachments: await Promise.all(attachments.map(async (a) => ({ filename: a.originalName, content: await readFile(join(process.env.ATTACHMENTS_DIR || join(process.cwd(), 'uploads'), a.storageName)), contentType: a.mimeType }))),
      });
      return { sent: true, messageId: info.messageId };
    } catch (e) {
      const classified = classifySendError(e);
      this.logger.error(`SMTP send failed: ${(e as Error).message}`);
      return { sent: false, error: (e as Error).message, ...classified };
    }
  }
}
