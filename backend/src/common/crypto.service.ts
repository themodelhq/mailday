import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption for secrets at rest (e.g. IMAP passwords).
 * Key is derived from VAULT_SECRET (or a dev fallback) via SHA-256 so it is
 * always exactly 32 bytes. Format: iv:tag:ciphertext (all hex).
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger('Crypto');
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.get<string>('VAULT_SECRET') ?? 'dev-vault-secret-change-me';
    this.key = createHash('sha256').update(secret).digest();
    if (!config.get<string>('VAULT_SECRET')) {
      this.logger.warn('VAULT_SECRET not set — using insecure dev key. Set it in production.');
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(data: string): string {
    const [ivHex, tagHex, encHex] = data.split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
