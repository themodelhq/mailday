/**
 * Convert untrusted HTML email content to plain text for display/indexing.
 * This is intentionally text-only: Mailday does not render inbound HTML.
 */
const BLOCKED_CONTENT = /<(script|style|iframe|object|embed|svg|math|template|noscript)\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>/gi;
const BLOCK_TAGS = /<\\/?(p|div|li|tr|h[1-6]|blockquote|br|hr)\\b[^>]*>/gi;
const ALL_TAGS = /<[^>]*>/g;

function decodeEntity(entity: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    copy: '©', reg: '®', trade: '™', hellip: '…', ndash: '–', mdash: '—',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  };
  if (entity in named) return named[entity];
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const code = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }
  if (entity.startsWith('#')) {
    const code = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }
  return '';
}

export function htmlEmailToText(input: string): string {
  if (!input) return '';
  const safe = input.replace(BLOCKED_CONTENT, ' ');
  return safe
    .replace(BLOCK_TAGS, '\\n')
    .replace(ALL_TAGS, '')
    .replace(/&([a-zA-Z]+|#x[0-9a-fA-F]+|#X[0-9a-fA-F]+|#[0-9]+);/g, (_, entity: string) => decodeEntity(entity))
    .replace(/[\\t\\r ]+/g, ' ')
    .replace(/\\n[ \\t]+/g, '\\n')
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim();
}
