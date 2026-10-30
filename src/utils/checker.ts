import { FlagValue } from '../types/domain';

export interface CheckResultData {
  registeredOn: string;
  updatedOn: string;
  ssl: FlagValue;
  website: FlagValue;
  websiteReason?: string;
  dnsResolves?: boolean;
  registrar?: string;
  expiresOn?: string;
  nameservers?: string[];
  whoisUrl?: string;
  error?: string;
  durationMs: number;
}

export interface SupplementaryWhoisData {
  registeredOn?: string;
  updatedOn?: string;
  expiresOn?: string;
  nameservers?: string[];
  registrar?: string;
  whoisUrl: string;
}

/**
 * Format RDAP event date to YYYY-MM-DD
 */
function formatRdapDate(dateStr?: string): string {
  if (!dateStr) return 'no data';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    const match = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  } catch {
    // ignore
  }
  return 'no data';
}

/**
 * Extract Registrar name from RDAP entity array if available
 */
function extractRegistrar(data: any): string | undefined {
  try {
    if (!data || !Array.isArray(data.entities)) return undefined;
    for (const entity of data.entities) {
      if (Array.isArray(entity.roles) && entity.roles.includes('registrar')) {
        if (Array.isArray(entity.vcardArray) && Array.isArray(entity.vcardArray[1])) {
          const fnItem = entity.vcardArray[1].find((item: any) => item[0] === 'fn');
          if (fnItem && typeof fnItem[3] === 'string') {
            return fnItem[3];
          }
        }
        if (entity.handle) return entity.handle;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Parses events[] from RDAP JSON:
 * "registration" -> Registered On
 * "last changed" (or "last update") -> Updated On
 */
function parseRdapEvents(data: any): { registeredOn: string; updatedOn: string } {
  let registeredOn = 'no data';
  let updatedOn = 'no data';

  if (data && Array.isArray(data.events)) {
    for (const ev of data.events) {
      const action = (ev.eventAction || '').toLowerCase();
      if (action === 'registration' && registeredOn === 'no data') {
        registeredOn = formatRdapDate(ev.eventDate);
      } else if (
        (action === 'last changed' || action === 'last update') &&
        updatedOn === 'no data'
      ) {
        updatedOn = formatRdapDate(ev.eventDate);
      }
    }
  }

  return { registeredOn, updatedOn };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout helper
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 12000,
  parentSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

/**
/**
 * Helper to fetch RDAP URL as JSON with status inspection
 */
async function fetchRdapJson(
  url: string,
  signal: AbortSignal
): Promise<{ data: any; status: number } | null> {
  try {
    const res = await fetchWithTimeout(url, 4500, signal);
    if (!res.ok) {
      return { data: null, status: res.status };
    }
    const data = await res.json();
    return { data, status: res.status };
  } catch {
    return null;
  }
}

/**
 * === UPDATE 2 — WHOIS dates: retry until you find the date ===
 * 1. Call https://rdap.org/domain/{domain} up to 3 times (with short backoff on server errors).
 * 2. If rdap.org returns 404 or no data, immediately try the registry RDAP directly:
 *    - .com/.net -> https://rdap.verisign.com/com/v1/domain/{domain} (or /net/)
 *    - .org -> https://rdap.pir.org/domain/{domain}
 *    - .info -> https://rdap.nic.info/domain/{domain}
 * 3. Parse events[]: "registration" -> Registered On, "last changed" -> Updated On (YYYY-MM-DD).
 * 4. Only if ALL attempts fail -> show "no data".
 */
async function checkWhoisWithRetries(
  domain: string,
  signal: AbortSignal
): Promise<{ registeredOn: string; updatedOn: string; registrar?: string }> {
  // 1. Call https://rdap.org/domain/{domain} up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (signal.aborted) break;

    const rdapRes = await fetchRdapJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`, signal);
    if (rdapRes?.data) {
      const { registeredOn, updatedOn } = parseRdapEvents(rdapRes.data);
      if (registeredOn !== 'no data') {
        const registrar = extractRegistrar(rdapRes.data);
        return { registeredOn, updatedOn, registrar };
      }
    }

    // If rdap.org returns 404/400 (domain not found in rdap.org index), skip redundant retries
    if (rdapRes && (rdapRes.status === 404 || rdapRes.status === 400)) {
      break;
    }

    if (attempt < 3 && !signal.aborted) {
      await delay(800);
    }
  }

  // 2. If still no data, try registry RDAP directly:
  const lowerDomain = domain.toLowerCase();
  let registryUrl: string | null = null;

  if (lowerDomain.endsWith('.com')) {
    registryUrl = `https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(domain)}`;
  } else if (lowerDomain.endsWith('.net')) {
    registryUrl = `https://rdap.verisign.com/net/v1/domain/${encodeURIComponent(domain)}`;
  } else if (lowerDomain.endsWith('.org')) {
    registryUrl = `https://rdap.pir.org/domain/${encodeURIComponent(domain)}`;
  } else if (lowerDomain.endsWith('.info')) {
    registryUrl = `https://rdap.nic.info/domain/${encodeURIComponent(domain)}`;
  }

  if (registryUrl && !signal.aborted) {
    const regRes = await fetchRdapJson(registryUrl, signal);
    if (regRes?.data) {
      const { registeredOn, updatedOn } = parseRdapEvents(regRes.data);
      const registrar = extractRegistrar(regRes.data);
      if (registeredOn !== 'no data' || updatedOn !== 'no data') {
        return { registeredOn, updatedOn, registrar };
      }
    }
  }

  return { registeredOn: 'no data', updatedOn: 'no data' };
}

/**
 * Supplementary domain-status lookup using Whois.com:
 * URL pattern: https://www.whois.com/whois/{domain}
 *
 * Provides supplementary evidence for registration date, updated date, expiration date,
 * nameservers, and registrar.
 * If Whois.com blocks automated access, returns a CAPTCHA, or fails to load,
 * the domain check continues gracefully without failing.
 * A WHOIS expiration date alone never overrides evidence that the actual website is working.
 */
async function fetchWhoisComData(
  domain: string,
  signal: AbortSignal
): Promise<SupplementaryWhoisData | null> {
  const whoisUrl = `https://www.whois.com/whois/${encodeURIComponent(domain)}`;
  try {
    const jinaUrl = `https://r.jina.ai/${whoisUrl}`;
    const res = await fetchWithTimeout(jinaUrl, 4500, signal);
    if (!res.ok) return null;
    const txt = await res.text();
    if (!txt || txt.length < 50) return null;

    // Check if security challenge occurred with no domain data
    if (txt.includes('Security Check') && !txt.includes('Domain Information')) {
      return null;
    }

    const regMatch = txt.match(/(?:Registered On|Creation Date|Registered):?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    const updMatch = txt.match(/(?:Updated On|Updated Date|Updated):?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    const expMatch = txt.match(/(?:Expires On|Registry Expiry Date|Expires):?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    const nsMatches = txt.match(/Name Servers?:\s*([^\n\r]+(?:\n[^\n\r]+)?)/i);
    const registrarMatch = txt.match(/Registrar:\s*([^\n\r]+)/i);

    let nameservers: string[] | undefined = undefined;
    if (nsMatches && nsMatches[1]) {
      nameservers = nsMatches[1]
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes('.') && !s.includes('@') && !s.includes('http'));
    }

    return {
      registeredOn: regMatch ? regMatch[1] : undefined,
      updatedOn: updMatch ? updMatch[1] : undefined,
      expiresOn: expMatch ? expMatch[1] : undefined,
      nameservers: nameservers && nameservers.length > 0 ? nameservers : undefined,
      registrar: registrarMatch ? registrarMatch[1].trim() : undefined,
      whoisUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Google DNS: https://dns.google/resolve?name={domain}&type=A
 * Used to know if the domain resolves (status 0 + non-empty Answer array).
 */
export async function checkGoogleDns(
  domain: string,
  signal: AbortSignal
): Promise<{ resolves: boolean; ip?: string }> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
      {
        method: 'GET',
        headers: { Accept: 'application/dns-json, application/json' },
        signal,
      }
    );
    if (!res.ok) return { resolves: false };
    const data = await res.json();
    const hasAnswer = data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
    const ip = hasAnswer ? data.Answer[0]?.data : undefined;
    return { resolves: hasAnswer, ip };
  } catch {
    return { resolves: false };
  }
}

/**
 * SSL check (browser-direct):
 * Performs an independent HTTPS request to https://${domain} (and https://www.${cleanHost} if needed)
 * using { mode: "no-cors", redirect: "manual" }.
 * - Resolves -> TLS handshake succeeded (certificate valid, trusted, matches domain, not expired) -> SSL = "yes".
 * - Rejects -> TLS handshake failed (certificate expired, invalid/untrusted, hostname mismatch, connection refused) -> SSL = "no".
 * - redirect: 'manual' prevents the browser from failing valid SSL handshakes when a domain performs a cross-origin redirect.
 * - Completely independent of Website Check.
 */
async function checkSslDirect(
  domain: string,
  parentSignal?: AbortSignal
): Promise<FlagValue> {
  const timeoutMs = 12000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const cleanHost = domain.replace(/^(www\.)+/i, '');
  const candidateUrls = [
    `https://${domain}`,
    `https://www.${cleanHost}`,
  ];

  try {
    for (const url of candidateUrls) {
      if (controller.signal.aborted) break;

      // Try with redirect: 'manual' first (avoids cross-origin redirect TypeError in no-cors)
      try {
        await fetch(url, {
          mode: 'no-cors',
          redirect: 'manual',
          signal: controller.signal,
        });
        return 'yes';
      } catch {
        // Fallback: try standard redirect follow on same URL
        try {
          await fetch(url, {
            mode: 'no-cors',
            signal: controller.signal,
          });
          return 'yes';
        } catch {
          // Continue to next candidate URL (e.g. www.)
        }
      }
    }
    return 'no';
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

interface ProxyFetchResult {
  html: string;
  httpCode?: number;
  sslCertError?: boolean;
}

/**
 * Fetch with timeout helper supporting custom timeoutMs, AbortSignal, and headers
 */
async function fetchProxyUrl(
  url: string,
  timeoutMs: number = 18000,
  parentSignal?: AbortSignal,
  headers?: Record<string, string>
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    return res;
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

/**
 * Reads page content using an intelligent, resilient proxy chain:
 * 1. Direct fetch: fastest if server allows CORS or in Node
 * 2. Jina Reader: fast, renders JS/SPAs, follows HTTP/HTTPS and JS redirects.
 *    Uses domcontentloaded so continuous analytics/ads background requests do not block completion.
 *    Detects SSL certificate errors on HTTPS targets for immediate HTTP fallback.
 * 3. AllOrigins: returns full HTML + HTTP status code
 * 4. CodeTabs: returns raw HTML
 */
async function fetchThroughProxyChain(
  targetUrl: string,
  signal: AbortSignal,
  timeoutMs: number = 18000
): Promise<ProxyFetchResult | null> {
  // 0. Direct fetch attempt (fastest if server allows CORS or in Node)
  try {
    if (!signal.aborted) {
      const resDirect = await fetchProxyUrl(targetUrl, 2500, signal);
      if (resDirect.ok || resDirect.status === 404 || resDirect.status === 410) {
        const text = await resDirect.text();
        if (text && text.trim().length > 20) {
          return {
            html: text,
            httpCode: resDirect.status,
          };
        }
      }
    }
  } catch {
    // Direct fetch blocked by CORS or network, proceed to proxies
  }

  // 1. Jina Reader: https://r.jina.ai/{targetUrl}
  try {
    if (signal.aborted) return null;
    const jinaTimeoutSec = Math.min(Math.max(Math.round(timeoutMs / 1000), 15), 35);
    const resJina = await fetchProxyUrl(
      `https://r.jina.ai/${targetUrl}`,
      timeoutMs,
      signal,
      {
        'x-timeout': String(jinaTimeoutSec),
        'x-wait-until': 'domcontentloaded',
        'x-no-cache': 'true',
      }
    );

    const text = await resJina.text();

    // Check if Jina returned an SSL certificate error for an HTTPS target
    if (resJina.status === 422 && targetUrl.startsWith('https://')) {
      if (
        text.includes('ERR_CERT_') ||
        text.includes('ERR_SSL_') ||
        text.includes('certificate') ||
        text.includes('CERT_COMMON_NAME_INVALID')
      ) {
        return {
          html: '',
          httpCode: 422,
          sslCertError: true,
        };
      }
    }

    if (resJina.ok || resJina.status === 404 || resJina.status === 410) {
      if (text && text.trim().length > 20) {
        return {
          html: text,
          httpCode: resJina.status,
        };
      }
    }
  } catch {
    // Proceed to next proxy
  }

  // 2. AllOrigins
  try {
    if (signal.aborted) return null;
    const resAllOrigins = await fetchProxyUrl(
      `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      Math.min(timeoutMs, 14000),
      signal
    );
    if (resAllOrigins.ok) {
      try {
        const data = await resAllOrigins.json();
        if (data && typeof data.contents === 'string' && data.contents.trim().length > 0) {
          return {
            html: data.contents,
            httpCode: data.status?.http_code,
          };
        }
      } catch {
        // Returned non-JSON (e.g. Cloudflare error HTML)
      }
    }
  } catch {
    // Proceed to next proxy
  }

  // 3. CodeTabs
  try {
    if (signal.aborted) return null;
    const resCodeTabs = await fetchProxyUrl(
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      Math.min(timeoutMs, 14000),
      signal
    );
    if (resCodeTabs.ok || resCodeTabs.status === 404 || resCodeTabs.status === 410) {
      const text = await resCodeTabs.text();
      if (text && text.trim().length > 0) {
        return {
          html: text,
          httpCode: resCodeTabs.status,
        };
      }
    }
  } catch {
    // All proxies exhausted for this targetUrl
  }

  return null;
}

/**
 * Detects whether the page is currently in an incomplete loading or spinner state
 */
function isPageStillLoading(html: string, text: string): boolean {
  if (text.length < 90) {
    const lowerText = text.toLowerCase();
    const lowerHtml = html.toLowerCase();
    if (
      lowerText.includes('loading...') ||
      lowerText.includes('loading') ||
      lowerText.includes('please wait') ||
      lowerText.includes('one moment') ||
      lowerHtml.includes('class="spinner') ||
      lowerHtml.includes('id="spinner') ||
      lowerHtml.includes('class="loader') ||
      lowerHtml.includes('id="loader') ||
      lowerHtml.includes('class="loading') ||
      lowerHtml.includes('id="loading') ||
      lowerHtml.includes('<div id="root"></div>') ||
      lowerHtml.includes('<div id="app"></div>') ||
      lowerHtml.includes('<div id="__next"></div>')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts a redirect destination if the HTML is a JS redirect or meta refresh stub.
 */
function extractRedirectDestination(html: string, currentUrl: string): string | null {
  if (!html || typeof html !== 'string') return null;

  // 1. Meta refresh: <meta http-equiv="refresh" content="0; url=/something">
  const metaMatch =
    html.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?[^"'>]*url=([^"'>\s;]+)["']?[^>]*>/i) ||
    html.match(/<meta[^>]*content=["']?[^"'>]*url=([^"'>\s;]+)["']?[^>]*http-equiv=["']?refresh["']?[^>]*>/i);

  if (metaMatch && metaMatch[1]) {
    try {
      const dest = metaMatch[1].replace(/^['"]|['"]$/g, '').trim();
      if (dest && !dest.toLowerCase().startsWith('javascript:')) {
        return new URL(dest, currentUrl).href;
      }
    } catch {
      // ignore
    }
  }

  // 2. JavaScript redirect: window.location.href="/...", location.href="...", location.replace("...")
  const jsMatch =
    html.match(/(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
    html.match(/(?:window\.)?location\.replace\(\s*['"]([^'"]+)['"]\s*\)/i) ||
    html.match(/(?:window\.)?location\.assign\(\s*['"]([^'"]+)['"]\s*\)/i);

  if (jsMatch && jsMatch[1]) {
    try {
      const dest = jsMatch[1].trim();
      if (
        dest &&
        !dest.toLowerCase().startsWith('javascript:') &&
        !dest.startsWith('#')
      ) {
        return new URL(dest, currentUrl).href;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Normalizes text for 404 / page cannot be found checks:
 * - lowercase everything
 * - collapse all whitespace into single spaces
 * - remove punctuation: ! . … , " ' ( ) [ ]
 */
function normalizeFor404Check(str: string): string {
  return str
    .toLowerCase()
    .replace(/[!….,"'`()\[\]\-—–:;?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Content analysis: determines whether the loaded content represents a live website.
 * Priority:
 * 1. Confirmed 404 / "Sorry! That page cannot be found" -> ALWAYS "no"
 * 2. Namecheap expired-domain page ("Domain registration has expired.") -> "no"
 * 3. Parked domain / for sale markers -> "no"
 * 4. Active web server restrictions (403/401/405/429 or Cloudflare/WAF challenges) -> "yes"
 * 5. Normal website content -> "yes"
 */
export function analyzeHtmlContent(
  html: string,
  httpCode?: number
): { isLive: boolean; reason?: string; isDefinitiveError?: boolean } {
  // 1. Confirmed HTTP 404 or 410 -> "no"
  if (httpCode === 404 || httpCode === 410) {
    return { isLive: false, reason: `HTTP error ${httpCode}`, isDefinitiveError: true };
  }

  if (!html || typeof html !== 'string') {
    return { isLive: false, reason: 'Empty response body' };
  }

  // Strip <script> and <style> first
  let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  cleanHtml = cleanHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

  // Support both standard HTML <title> and Jina Reader's "Title: ..." header
  const titleMatch = cleanHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const jinaTitleMatch = cleanHtml.match(/^Title:\s*([^\n\r]+)/im);
  const titleText = titleMatch ? titleMatch[1] : (jinaTitleMatch ? jinaTitleMatch[1] : '');

  // Check Jina's explicit target URL 404/410 warning
  if (/target url returned error (?:404|410)/i.test(cleanHtml)) {
    return { isLive: false, reason: 'HTTP error 404 / 410', isDefinitiveError: true };
  }

  // Extract visible text (strip all HTML tags)
  let text = cleanHtml.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // === HIGHEST PRIORITY RULE — "404 / Sorry! That page cannot be found" -> ALWAYS "no" ===
  const combinedText = titleText + ' ' + text;
  const normalizedCombined = normalizeFor404Check(combinedText);
  const topNormalized = normalizeFor404Check(text.slice(0, 1500));
  const topRaw = text.slice(0, 1500).toLowerCase();

  // Condition 1: normalized text contains "404" AND "sorry" anywhere in the same page
  const has404AndSorry = normalizedCombined.includes('404') && normalizedCombined.includes('sorry');

  // Condition 2: contains "that page cannot be found" (any case, any punctuation)
  const hasThatPageCannotBeFound = normalizedCombined.includes('that page cannot be found');

  // Condition 3: near the top of visible text contains: "page cannot be found" / "page not found" / "cannot be found" / "can't be found" / "cant be found"
  const hasTopNotFound =
    topNormalized.includes('page cannot be found') ||
    topNormalized.includes('page not found') ||
    topNormalized.includes('cannot be found') ||
    topNormalized.includes('cant be found') ||
    topNormalized.includes('can t be found') ||
    topRaw.includes("can't be found") ||
    topRaw.includes('cannot be found') ||
    topRaw.includes('page not found') ||
    topRaw.includes('page cannot be found');

  if (has404AndSorry || hasThatPageCannotBeFound || hasTopNotFound) {
    return {
      isLive: false,
      reason: '404 / Sorry! That page cannot be found detected',
      isDefinitiveError: true,
    };
  }

  // === Namecheap expired-domain page detection ===
  const lowerHtml = cleanHtml.toLowerCase();
  const lowerText = text.toLowerCase();
  const hasExpiredHeading =
    normalizedCombined.includes('domain registration has expired') ||
    normalizedCombined.includes('domain has expired') ||
    normalizedCombined.includes('renew this domain') ||
    topNormalized.includes('domain registration has expired');

  const hasNamecheapBranding =
    lowerHtml.includes('namecheap') ||
    lowerText.includes('namecheap') ||
    lowerHtml.includes('parkingpage') ||
    lowerHtml.includes('registrar-servers');

  if (hasExpiredHeading && (hasNamecheapBranding || normalizedCombined.includes('domain registration has expired'))) {
    return {
      isLive: false,
      reason: 'Namecheap expired-domain page: "Domain registration has expired."',
      isDefinitiveError: true,
    };
  }

  // === Distinguish server bot blocks and server responses from website failures ===
  // If the server returns 401, 403, 405, 429 or a Cloudflare/WAF challenge,
  // the server is actively running and responding (automated requests restricted).
  if (httpCode === 401 || httpCode === 403 || httpCode === 405 || httpCode === 429) {
    return {
      isLive: true,
      reason: `Server responded with HTTP ${httpCode} (automated access restricted)`,
    };
  }

  // HTTP 500, 502, 503, 504 are web server responses from an active web server (maintenance/error)
  if (httpCode === 500 || httpCode === 502 || httpCode === 503 || httpCode === 504) {
    return {
      isLive: true,
      reason: `Server responded with HTTP ${httpCode} (web server active)`,
    };
  }

  const isBotChallenge =
    lowerHtml.includes('attention required! | cloudflare') ||
    lowerHtml.includes('just a moment...') ||
    lowerHtml.includes('verify you are human') ||
    lowerHtml.includes('security check to access') ||
    lowerText.includes('checking your browser') ||
    lowerText.includes('cloudflare ray id');

  if (isBotChallenge) {
    return {
      isLive: true,
      reason: 'Server responded (security challenge / automated requests restricted)',
    };
  }

  // <title> (lowercase) contains error indicators -> "no"
  if (titleText) {
    const lowerTitle = titleText.toLowerCase();
    const badTitleMarkers = [
      '404',
      'not found',
      'cannot be found',
      "can't be found",
      'page cannot',
    ];
    for (const marker of badTitleMarkers) {
      if (lowerTitle.includes(marker)) {
        return { isLive: false, reason: `Title contains error marker "${marker}"` };
      }
    }
  }

  const sampleText = text.slice(0, 3000).toLowerCase();

  const badMarkers = [
    'no brand config',
    'domain registration has expired',
    'domain has expired',
    'renew this domain',
    'domain is for sale',
    'buy this domain',
    'parked domain',
    'domain parking',
    'sedo',
    'afternic',
    'hugedomains',
    'future home of',
    'coming soon',
    'welcome to nginx',
    'apache2 default',
    'iis windows server',
    "this site can't be reached",
    'web server is down',
    'account suspended',
    'site not published',
    'under construction',
    'bid now',
    'domains on auction',
  ];

  for (const marker of badMarkers) {
    if (sampleText.includes(marker)) {
      return { isLive: false, reason: `Parked/error pattern detected: "${marker}"` };
    }
  }

  // Reject only if completely empty (zero visible text and zero HTML)
  if (text.length === 0 && html.length === 0) {
    return {
      isLive: false,
      reason: 'Empty response body',
    };
  }

  // Valid website content
  return { isLive: true };
}

/**
 * Checks website availability using intelligent page loading, protocol prioritization,
 * and automatic retries for slow-loading websites:
 * 1. Intelligent loading: uses domcontentloaded, increased timeouts up to 30-45s per domain.
 * 2. Automatic retries: if attempt 1 is inconclusive, retries automatically with progressively longer waiting periods.
 * 3. Protocol order: tries HTTPS and HTTP (prioritizing HTTP if SSL failed or had certificate errors).
 * 4. Website detection: returns "yes" when meaningful content, logo, navigation, headings, or images appear.
 * 5. Returns "no" only for definitive 404 / "Sorry! That page cannot be found...", Namecheap expired domain,
 *    or confirmed permanent DNS/connection failures.
 */
export async function checkWebsiteWithContentAnalysis(
  domain: string,
  signal: AbortSignal,
  dnsResolves: boolean = true
): Promise<{ website: FlagValue; websiteReason?: string }> {
  const cleanHost = domain.replace(/^(www\.)+/i, '');

  let gotAnyHtml = false;
  let lastFailureReason = 'Could not retrieve page content';
  let hadSslCertError = false;

  // Maximum of 2 attempts (Attempt 1: intelligent load, Attempt 2: extended retry for slow sites)
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (signal.aborted) break;

    // Timeout per proxy attempt: 18s on attempt 1, 26s on attempt 2
    const attemptTimeoutMs = attempt === 1 ? 18000 : 26000;

    // Determine candidate URL order:
    // If previously encountered SSL cert error on HTTPS: HTTP first, then HTTPS
    // Otherwise: HTTPS first, then HTTP fallback
    const candidateUrls = hadSslCertError
      ? [
          `http://${domain}`,
          `https://${domain}`,
          `http://www.${cleanHost}`,
          `https://www.${cleanHost}`,
        ]
      : [
          `https://${domain}`,
          `http://${domain}`,
          `https://www.${cleanHost}`,
          `http://www.${cleanHost}`,
        ];

    for (const candidateUrl of candidateUrls) {
      if (signal.aborted) break;

      const proxyData = await fetchThroughProxyChain(candidateUrl, signal, attemptTimeoutMs);
      if (!proxyData) {
        continue;
      }

      // If an SSL certificate error was identified on HTTPS, note it and prioritize HTTP
      if (proxyData.sslCertError) {
        hadSslCertError = true;
        continue;
      }

      gotAnyHtml = true;

      // Check if redirect stub (JS redirect or meta refresh)
      let finalHtml = proxyData.html;
      let finalHttpCode = proxyData.httpCode;

      if (proxyData.html.length < 5120) {
        const redirectTarget = extractRedirectDestination(proxyData.html, candidateUrl);
        if (redirectTarget && redirectTarget !== candidateUrl) {
          const hopData = await fetchThroughProxyChain(redirectTarget, signal, attemptTimeoutMs);
          if (hopData && hopData.html) {
            finalHtml = hopData.html;
            finalHttpCode = hopData.httpCode;
          }
        }
      }

      // Check if page is in an incomplete loading or spinner state
      if (isPageStillLoading(finalHtml, finalHtml.replace(/<[^>]+>/g, ' ').trim()) && attempt === 1 && !signal.aborted) {
        await delay(1500);
        const reloadData = await fetchThroughProxyChain(candidateUrl, signal, attemptTimeoutMs);
        if (reloadData && reloadData.html) {
          finalHtml = reloadData.html;
          finalHttpCode = reloadData.httpCode;
        }
      }

      // Analyze page content
      const analysis = analyzeHtmlContent(finalHtml, finalHttpCode);
      if (analysis.isLive) {
        return {
          website: 'yes',
          websiteReason: attempt > 1 ? `${analysis.reason || 'Live website verified'} (loaded after retry)` : analysis.reason,
        };
      } else {
        lastFailureReason = analysis.reason || 'Failed content analysis';
        if (analysis.isDefinitiveError) {
          return { website: 'no', websiteReason: analysis.reason };
        }
      }
    }

    // If attempt 1 did not produce a result, wait before progressive retry
    if (attempt < 2 && !signal.aborted) {
      await delay(1000);
    }
  }

  // If HTML was obtained on any attempt and failed analysis (e.g. parked/for sale) -> "no"
  if (gotAnyHtml) {
    return { website: 'no', websiteReason: lastFailureReason };
  }

  // If DNS confirmed failed and all connection attempts failed -> "no"
  if (!dnsResolves) {
    return {
      website: 'no',
      websiteReason: 'Permanent DNS failure: domain does not resolve',
    };
  }

  // If DNS resolves but connection timed out after retries, return inconclusive '?'
  // (per requirement 4: do not falsely report a confirmed website failure when slow)
  return {
    website: '?',
    websiteReason: 'Connection timed out after retries (server may be slow or restricted)',
  };
}

/**
 * Checks a single domain with an intelligent 40s timeout AbortController.
 * One bad domain never crashes or stops the whole run.
 */
export async function checkSingleDomain(
  domain: string,
  timeoutMs: number = 40000,
  parentSignal?: AbortSignal
): Promise<CheckResultData> {
  const startTime = performance.now();
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  let dnsResult: { resolves: boolean; ip?: string } = { resolves: false };
  let sslResult: FlagValue = 'no';
  let whoisResult: { registeredOn: string; updatedOn: string; registrar?: string } = {
    registeredOn: 'no data',
    updatedOn: 'no data',
  };
  let whoisComData: SupplementaryWhoisData | null = null;
  let websiteResult: { website: FlagValue; websiteReason?: string } = { website: 'no' };

  try {
    // 1. Direct SSL check (browser-direct) and Google DNS
    // 2. Primary WHOIS lookup (RDAP with retries + registry fallback)
    // and Supplementary Whois.com lookup (pattern: https://www.whois.com/whois/{domain})
    // 3. Website content analysis with intelligent loading and retries
    // NOTE: SSL Check and Website Check operate completely independently.
    try {
      [dnsResult, sslResult, whoisResult, whoisComData, websiteResult] = await Promise.all([
        checkGoogleDns(domain, controller.signal),
        checkSslDirect(domain, controller.signal),
        checkWhoisWithRetries(domain, controller.signal),
        fetchWhoisComData(domain, controller.signal),
        checkWebsiteWithContentAnalysis(
          domain,
          controller.signal,
          dnsResult.resolves
        ),
      ]);
    } catch {
      // Continue with whatever succeeded
    }

    let registeredOn = whoisResult.registeredOn;
    let updatedOn = whoisResult.updatedOn;
    let registrar = whoisResult.registrar;

    // Use Whois.com as supplementary evidence if RDAP returned no data
    if (registeredOn === 'no data' && whoisComData?.registeredOn) {
      registeredOn = whoisComData.registeredOn;
    }
    if (updatedOn === 'no data' && whoisComData?.updatedOn) {
      updatedOn = whoisComData.updatedOn;
    }
    if (!registrar && whoisComData?.registrar) {
      registrar = whoisComData.registrar;
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      registeredOn,
      updatedOn,
      registrar,
      expiresOn: whoisComData?.expiresOn,
      nameservers: whoisComData?.nameservers,
      whoisUrl: `https://www.whois.com/whois/${encodeURIComponent(domain)}`,
      dnsResolves: dnsResult.resolves,
      ssl: sslResult,
      website: websiteResult.website,
      websiteReason: websiteResult.websiteReason,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    return {
      registeredOn: whoisResult.registeredOn || 'no data',
      updatedOn: whoisResult.updatedOn || 'no data',
      registrar: whoisResult.registrar,
      ssl: sslResult,
      website: websiteResult.website !== 'pending' ? websiteResult.website : (dnsResult.resolves ? '?' : 'no'),
      websiteReason: websiteResult.websiteReason || 'Check failed',
      error: err?.message || 'Check failed',
      durationMs,
    };
  } finally {
    clearTimeout(timeoutId);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}
