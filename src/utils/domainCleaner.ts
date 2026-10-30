/**
 * Cleans a raw domain string:
 * - Strips protocol (https://, http://, ftp://, etc.)
 * - Strips leading 'www.'
 * - Strips paths, query parameters, and URL fragments
 * - Strips port numbers (:80, :443, etc.)
 * - Trims whitespace, quotes, commas, trailing periods
 * - Converts to lowercase
 */
export function cleanDomain(raw: string): string | null {
  if (!raw) return null;

  let cleaned = raw.trim();

  // Remove surrounding quotes, backticks, brackets
  cleaned = cleaned.replace(/^["'`(\[<]+|["'`)\]>]+$/g, '').trim();

  // Strip protocol (http://, https://, ftp://, etc.)
  cleaned = cleaned.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');

  // Strip user info if present (e.g., user:pass@domain.com)
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@').pop() || '';
  }

  // Strip paths, query strings, hashes (take only the host part)
  cleaned = cleaned.split(/[/?#]/)[0];

  // Strip port number (e.g., domain.com:8080)
  cleaned = cleaned.split(':')[0];

  // Lowercase
  cleaned = cleaned.toLowerCase().trim();

  // Strip leading www. (or multiple www. prefixes)
  cleaned = cleaned.replace(/^(www\.)+/i, '');

  // Strip trailing or leading dots or hyphens
  cleaned = cleaned.replace(/^[.-]+|[.-]+$/g, '');

  // Basic validation:
  // Must contain at least one dot, cannot contain spaces, valid characters
  // TLD should be at least 2 characters (e.g. .co, .com, .ai, .io, .org, .de)
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;

  if (!domainRegex.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Extracts, cleans, and deduplicates domains from pasted text or file contents (.txt / .csv).
 */
export function cleanAndDedupeDomains(rawText: string): string[] {
  if (!rawText) return [];

  // Split by common delimiters: newline, comma, semicolon, tab, space
  const rawTokens = rawText.split(/[\r\n,;\t]+/);
  const seen = new Set<string>();
  const results: string[] = [];

  for (const token of rawTokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    // Check if line contains space-separated tokens or CSV quotes
    const subTokens = trimmed.split(/\s+/);
    for (const sub of subTokens) {
      const cleaned = cleanDomain(sub);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        results.push(cleaned);
      }
    }
  }

  return results;
}
