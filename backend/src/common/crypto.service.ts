import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** AES-256-GCM encryption for secrets at rest (e.g. IMAP passwords). */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger('Crypto');
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.get<string>('VAULT_SECRET');
    if (!secret && config.get<string>('NODE_ENV') === 'production') {
      throw new Error('VAULT_SECRET must be configured in production');
    }
    const effectiveSecret = secret ?? 'local-development-only-vault-secret';
    this.key = createHash('sha256').update(effectiveSecret).digest();
    if (!secret) this.logger.warn('VAULT_SECRET not set — using local development key.');
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
    if (!ivHex || !tagHex || encHex === undefined) throw new Error('Invalid encrypted secret format');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
