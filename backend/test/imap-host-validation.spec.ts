import { isPublicAddress, resolveValidatedImapHost, validateImapHost } from '../src/mail/imap-host-validation';

describe('IMAP host validation', () => {
  it.each([
    ['127.0.0.1', false], ['10.1.2.3', false], ['172.16.0.1', false],
    ['172.31.255.255', false], ['192.168.1.10', false], ['169.254.10.20', false],
    ['100.64.0.1', false], ['192.0.2.10', false], ['192.0.0.5', false],
    ['198.51.100.5', false], ['203.0.113.10', false], ['224.0.0.1', false],
    ['8.8.8.8', true], ['1.1.1.1', true], ['2001:4860:4860::8888', true],
    ['2001:db8::1', false], ['2001:0::1', false], ['2001:0000::1', false], ['2001:0001::1', false], ['2002::1', false],
    ['3fff::1', false], ['fe80::1', false], ['fc00::1', false],
    ['::1', false], ['::ffff:127.0.0.1', false],
  ])('classifies %s as public=%s', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });

  it('rejects localhost and private IP literals', async () => {
    await expect(validateImapHost('localhost')).rejects.toThrow('IMAP servers must resolve to public IP addresses');
    await expect(validateImapHost('127.0.0.1')).rejects.toThrow('IMAP servers must resolve to public IP addresses');
    await expect(validateImapHost('192.168.1.1')).rejects.toThrow('IMAP servers must resolve to public IP addresses');
  });

  it('returns pinned addresses for IP literals without DNS re-resolution', async () => {
    await expect(resolveValidatedImapHost('8.8.8.8')).resolves.toMatchObject({
      originalHost: '8.8.8.8', address: '8.8.8.8', family: 4, servername: false,
    });
    await expect(resolveValidatedImapHost('2001:4860:4860::8888')).resolves.toMatchObject({
      address: '2001:4860:4860::8888', family: 6, servername: false,
    });
  });

  it('rejects malformed host strings', async () => {
    await expect(validateImapHost('https://example.com')).rejects.toThrow('Invalid IMAP server hostname');
    await expect(validateImapHost('user@example.com')).rejects.toThrow('Invalid IMAP server hostname');
  });
});
