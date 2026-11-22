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
  if (errorCode && ['EAUTH', 'EENVELOPE', 'EMESSAGE', 'EBADNAME', 'ENOTFOUND', 'EINVAL'].includes(errorCode)) {
    return { errorCode, retryable: false };
  }
  return { errorCode, retryable: true };
}

/** Accept a hostname or SMTP URL, but pass Nodemailer a clean hostname. */
export function normalizeSmtpHost(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('SMTP_HOST is empty');
  let hostname: string;
  try {
    const parsed = new URL(raw.includes('://') ? raw : `smtp://${raw}`);
    hostname = parsed.hostname;
  } catch {
    throw new Error('Invalid SMTP_HOST. Set it to a hostname such as smtp.gmail.com (not a malformed URL).');
  }
  if (!hostname || hostname.includes(' ') || hostname.startsWith(':')) {
    throw new Error('Invalid SMTP_HOST. Set it to a hostname such as smtp.gmail.com.');
  }
  return hostname;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: nodemailer.Transporter | null = null;
  private readonly resendApiKey: string;
  readonly enabled: boolean;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.resendApiKey = config.get<string>('RESEND_API_KEY') ?? '';
    this.from = config.get<string>('MAIL_FROM') ?? 'noreply@mailday.app';
    const rawHost = config.get<string>('SMTP_HOST');
    if (this.resendApiKey) {
      this.enabled = true;
      this.logger.log('HTTPS email delivery enabled via Resend API (SMTP is bypassed).');
      return;
    }
    if (rawHost) {
      try {
        const host = normalizeSmtpHost(rawHost);
        this.transporter = nodemailer.createTransport({
          host,
          port: parseInt(config.get<string>('SMTP_PORT') ?? '587', 10),
          secure: (config.get<string>('SMTP_SECURE') ?? 'false') === 'true',
          auth: config.get<string>('SMTP_USER') ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') } : undefined,
          connectionTimeout: Number(config.get<string>('SMTP_CONNECTION_TIMEOUT_MS') ?? 15000),
          greetingTimeout: Number(config.get<string>('SMTP_GREETING_TIMEOUT_MS') ?? 15000),
          socketTimeout: Number(config.get<string>('SMTP_SOCKET_TIMEOUT_MS') ?? 60000),
        });
        this.enabled = true;
        this.logger.log(`SMTP enabled (${host}); timeouts: connection/greeting=15s, socket=60s unless configured`);
      } catch (error) {
        this.enabled = false;
        this.logger.error((error as Error).message);
        this.logger.error('SMTP disabled due to invalid SMTP_HOST configuration.');
      }
    } else {
      this.enabled = false;
      this.logger.warn('No RESEND_API_KEY or SMTP_HOST configured; outbound email is disabled.');
    }
  }

  async verify(): Promise<boolean> {
    if (this.resendApiKey) return true; // API credentials are checked on the first send.
    if (!this.transporter) return false;
    try { return await this.transporter.verify(); } catch { return false; }
  }

  async send(to: string[], subject: string, html: string, cc: string[] = [], bcc: string[] = [], attachments: { storageName: string; originalName: string; mimeType: string }[] = []): Promise<SendResult> {
    if (this.resendApiKey) return this.sendViaResend(to, subject, html, cc, bcc, attachments);
    if (!this.transporter) return { sent: false, error: 'MAIL_PROVIDER_NOT_CONFIGURED', errorCode: 'MAIL_PROVIDER_NOT_CONFIGURED', retryable: false };
    try {
      const info = await this.transporter.sendMail({
        from: this.from, to, cc: cc.length ? cc : undefined, bcc: bcc.length ? bcc : undefined, subject, html,
        attachments: await Promise.all(attachments.map(async a => ({ filename: a.originalName, content: await readFile(join(process.env.ATTACHMENTS_DIR || join(process.cwd(), 'uploads'), a.storageName)), contentType: a.mimeType }))),
      });
      return { sent: true, messageId: info.messageId };
    } catch (e) {
      const classified = classifySendError(e);
      this.logger.error(`SMTP send failed [${classified.errorCode ?? 'unknown'}]: ${(e as Error).message}`);
      return { sent: false, error: (e as Error).message, ...classified };
    }
  }

  private async sendViaResend(to: string[], subject: string, html: string, cc: string[], bcc: string[], attachments: { storageName: string; originalName: string; mimeType: string }[]): Promise<SendResult> {
    try {
      const files = await Promise.all(attachments.map(async a => ({ filename: a.originalName, content: (await readFile(join(process.env.ATTACHMENTS_DIR || join(process.cwd(), 'uploads'), a.storageName))).toString('base64') })));
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.resendApiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ from: this.from, to, ...(cc.length ? { cc } : {}), ...(bcc.length ? { bcc } : {}), subject, html, ...(files.length ? { attachments: files } : {}) }),
      });
      const result = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
      if (!response.ok) {
        const code = String(response.status);
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        const error = result.message ?? result.name ?? `Resend API returned HTTP ${response.status}`;
        this.logger.error(`Resend send failed HTTP ${response.status}: ${error}`);
        return { sent: false, error, errorCode: code, retryable };
      }
      if (!result.id) return { sent: false, error: 'Resend API response did not include an email ID', errorCode: 'RESEND_INVALID_RESPONSE', retryable: true };
      this.logger.log(`Email accepted by Resend API; id=${result.id}`);
      return { sent: true, messageId: result.id };
    } catch (e) {
      const err = e as { name?: string; message?: string; code?: string };
      const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
      return { sent: false, error: timedOut ? 'Resend API request timed out after 20 seconds' : (err.message ?? 'Resend API request failed'), errorCode: timedOut ? 'ETIMEDOUT' : (err.code ?? 'RESEND_API_ERROR'), retryable: true };
    }
  }
}
