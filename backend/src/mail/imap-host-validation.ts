import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    const blocked =
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 2 || b === 168 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      (a === 100 && b >= 64 && b <= 127);
    return !blocked;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    const inGlobalUnicast = normalized.startsWith('2') || normalized.startsWith('3');
    const excludedPrefixes = [
      '2001:', '2002:', '3fff:',
    ];
    return inGlobalUnicast && !excludedPrefixes.some((prefix) => normalized.startsWith(prefix));
  }
  return false;
}

export interface ValidatedImapHost {
  originalHost: string;
  address: string;
  family: 4 | 6;
  servername: string | false;
}

export async function resolveValidatedImapHost(host: string): Promise<ValidatedImapHost> {
  const normalized = host.trim().replace(/^\\[|\\]$/g, '');
  if (!normalized || normalized.includes('/') || normalized.includes('\\\\') || normalized.includes('@')) {
    throw new BadRequestException('Invalid IMAP server hostname');
  }
  try {
    const literalFamily = isIP(normalized);
    const addresses = literalFamily
      ? [{ address: normalized, family: literalFamily }]
      : await lookup(normalized, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
      throw new BadRequestException('IMAP servers must resolve to public IP addresses');
    }
    const selected = addresses[0];
    return {
      originalHost: normalized,
      address: selected.address,
      family: selected.family as 4 | 6,
      servername: literalFamily ? false : normalized,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Could not resolve IMAP server hostname');
  }
}

export async function validateImapHost(host: string): Promise<void> {
  await resolveValidatedImapHost(host);
}
