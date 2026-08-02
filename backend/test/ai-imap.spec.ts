import { CryptoService } from '../src/common/crypto.service';
import { AiService } from '../src/ai/ai.service';
import { ImapService } from '../src/mail/imap.service';

const noopConfig: any = { get: () => undefined };

describe('AI + IMAP + Crypto integration', () => {
  it('CryptoService encrypts and decrypts symmetrically', () => {
    const crypto = new CryptoService(noopConfig);
    const secret = 'super-secret-imap-password';
    const enc = crypto.encrypt(secret);
    expect(enc).not.toBe(secret);
    expect(crypto.decrypt(enc)).toBe(secret);
  });

  it('AiService is disabled and throws when ZAI_API_KEY is unset', async () => {
    const ai = new AiService(noopConfig);
    expect(ai.enabled).toBe(false);
    await expect(ai.generate('draft', 'hello')).rejects.toThrow('AI_NOT_CONFIGURED');
  });

  it('ImapService pollAll is a safe no-op when there are no connected accounts', async () => {
    const prismaMock: any = { imapAccount: { findMany: jest.fn(async () => []) } };
    const esMock: any = { enabled: false, indexMessage: jest.fn(), updateMessage: jest.fn(), removeMessage: jest.fn() };
    const redisMock: any = { invalidatePrefix: jest.fn() };
    const imap = new ImapService(prismaMock, redisMock, esMock, new CryptoService(noopConfig));
    await expect(imap.pollAll()).resolves.toBeUndefined();
    expect(prismaMock.imapAccount.findMany).toHaveBeenCalled();
  });
});
