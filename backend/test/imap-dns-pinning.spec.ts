jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

import { lookup } from 'dns/promises';
import { resolveValidatedImapHost } from '../src/mail/imap-host-validation';

const mockedLookup = lookup as jest.Mock;

describe('IMAP DNS pinning', () => {
  beforeEach(() => mockedLookup.mockReset());

  it('pins a resolved public address while retaining the hostname for TLS SNI', async () => {
    mockedLookup.mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '2001:4860:4860::8888', family: 6 },
    ]);
    await expect(resolveValidatedImapHost('imap.example.com')).resolves.toEqual({
      originalHost: 'imap.example.com',
      address: '8.8.8.8',
      family: 4,
      servername: 'imap.example.com',
    });
    expect(mockedLookup).toHaveBeenCalledWith('imap.example.com', { all: true, verbatim: true });
  });

  it('rejects a hostname when any DNS answer is private', async () => {
    mockedLookup.mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(resolveValidatedImapHost('mixed.example.com')).rejects.toThrow(
      'IMAP servers must resolve to public IP addresses',
    );
  });

  it('rejects hostnames with no DNS results', async () => {
    mockedLookup.mockResolvedValue([]);
    await expect(resolveValidatedImapHost('missing.example.com')).rejects.toThrow(
      'IMAP servers must resolve to public IP addresses',
    );
  });

  it('converts DNS resolver errors into a safe validation error', async () => {
    mockedLookup.mockRejectedValue(new Error('resolver details'));
    await expect(resolveValidatedImapHost('broken.example.com')).rejects.toThrow(
      'Could not resolve IMAP server hostname',
    );
  });
});
