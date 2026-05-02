// ═══ SCRAPER: Google Custom Search API ═══
// Busca síndicos profissionais com telefone via Google.
// Free tier: 100 queries/dia. Conservador: 2-3 queries por HAWKEYE run.
//
// Modo 1: Google Custom Search JSON API (precisa de API key + CX)
// Modo 2: Fallback via fetch direto no Google (sem API key, rate-limited)

import type { ScrapedContact } from './condominio-em-foco';

// ═══ Brazilian phone regex ═══
// Matches: (11) 99999-9999, (011) 9999-9999, (11) 99999.9999, etc.
const PHONE_REGEX = /\(0?[1-9]\d\)\s*\d{4,5}[-.\s]?\d{4}/g;

// ═══ Query templates — conserva queries (2-3 por run) ═══
const DEFAULT_QUERIES = [
  'síndico profissional telefone contato',
  'síndico condomínio telefone celular',
  'administradora condomínio síndico contato telefone',
];

function buildQueries(cities?: string[]): string[] {
  const targetCities = cities && cities.length > 0
    ? cities
    : ['São Paulo', 'Rio de Janeiro', 'Curitiba'];

  // Max 3 queries to conserve free tier (100/day)
  const queries: string[] = [];
  for (let i = 0; i < Math.min(targetCities.length, 3); i++) {
    const city = targetCities[i];
    const template = DEFAULT_QUERIES[i % DEFAULT_QUERIES.length];
    queries.push(`${template} ${city}`);
  }
  return queries;
}

// ═══ Phone normalization (same logic as other scrapers) ═══
function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  // Remove leading 0 from area code (011 → 11)
  if (digits.startsWith('0')) digits = digits.substring(1);

  // Add country code if missing
  if (!digits.startsWith('55')) digits = `55${digits}`;

  // Validate: 55 + DDD(2) + number(8-9) = 12-13 digits
  if (digits.length < 12 || digits.length > 13) return '';

  return digits;
}

// ═══ Extract name from search result title ═══
function extractNameFromTitle(title: string): string {
  // Remove common suffixes/noise
  let name = title
    .replace(/\s*[-–|]\s*.*/g, '') // Remove everything after dash/pipe
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical
    .replace(/síndic[oa]\s+profissional\s*/gi, '') // Remove role prefix
    .replace(/administradora?\s*/gi, '')
    .replace(/condomínio\s*/gi, '')
    .trim();

  // If too short after cleanup, use original title truncated
  if (name.length < 3) {
    name = title.split(/[-–|]/)[0].trim();
  }

  return name.substring(0, 100);
}

// ═══ Extract contacts from search result text ═══
function extractContactsFromResult(
  title: string,
  snippet: string,
  link: string,
  city: string,
  state: string,
): ScrapedContact[] {
  const contacts: ScrapedContact[] = [];
  const combinedText = `${title} ${snippet}`;

  // Find all phone numbers in the combined text
  const phones = combinedText.match(PHONE_REGEX);
  if (!phones || phones.length === 0) return [];

  const name = extractNameFromTitle(title);
  if (!name || name.length < 3) return [];

  // Extract email if present
  const emailMatch = combinedText.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  // Use first valid phone found
  for (const rawPhone of phones) {
    const phone = cleanPhone(rawPhone);
    if (!phone) continue;

    contacts.push({
      name,
      phone,
      fax: null,
      website: link || null,
      email,
      neighborhood: null,
      source: 'google_search',
      city,
      state,
    });
    break; // One contact per search result
  }

  return contacts;
}

// ═══ Detect city/state from query ═══
function detectCityState(query: string): { city: string; state: string } {
  const cityMap: Record<string, { city: string; state: string }> = {
    'são paulo': { city: 'São Paulo', state: 'SP' },
    'sp': { city: 'São Paulo', state: 'SP' },
    'rio de janeiro': { city: 'Rio de Janeiro', state: 'RJ' },
    'rj': { city: 'Rio de Janeiro', state: 'RJ' },
    'curitiba': { city: 'Curitiba', state: 'PR' },
    'belo horizonte': { city: 'Belo Horizonte', state: 'MG' },
    'porto alegre': { city: 'Porto Alegre', state: 'RS' },
    'brasília': { city: 'Brasília', state: 'DF' },
    'salvador': { city: 'Salvador', state: 'BA' },
    'recife': { city: 'Recife', state: 'PE' },
    'fortaleza': { city: 'Fortaleza', state: 'CE' },
    'campinas': { city: 'Campinas', state: 'SP' },
  };

  const lower = query.toLowerCase();
  for (const [key, value] of Object.entries(cityMap)) {
    if (lower.includes(key)) return value;
  }

  return { city: 'Brasil', state: '' };
}

// ═══ MODE 1: Google Custom Search JSON API ═══
async function searchWithAPI(
  query: string,
  apiKey: string,
  cx: string,
): Promise<ScrapedContact[]> {
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '10');
  url.searchParams.set('gl', 'br');
  url.searchParams.set('lr', 'lang_pt');

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[GoogleSearch] API error ${res.status}: ${text.substring(0, 200)}`);
    return [];
  }

  const data = await res.json();
  const items = data.items || [];
  const { city, state } = detectCityState(query);
  const contacts: ScrapedContact[] = [];

  for (const item of items) {
    const title = item.title || '';
    const snippet = item.snippet || '';
    const link = item.link || '';

    const extracted = extractContactsFromResult(title, snippet, link, city, state);
    contacts.push(...extracted);
  }

  return contacts;
}

// ═══ MODE 2: Fallback — scrape Google HTML (no API key needed) ═══
async function searchWithFallback(query: string): Promise<ScrapedContact[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=pt-BR&gl=br`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    if (!res.ok) {
      console.error(`[GoogleSearch] Fallback HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();

    // Check for CAPTCHA/block
    if (html.includes('unusual traffic') || html.includes('captcha')) {
      console.warn('[GoogleSearch] Fallback blocked by Google (CAPTCHA)');
      return [];
    }

    const { city, state } = detectCityState(query);
    const contacts: ScrapedContact[] = [];

    // Extract search result blocks — look for class="BNeawe" or similar snippet containers
    // Google HTML structure varies, so we use a broad approach
    const text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/span>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#8211;/g, '–')
      .replace(/&#8217;/g, "'")
      .replace(/&quot;/g, '"');

    // Find all phone numbers in the page text
    const phoneMatches = text.match(PHONE_REGEX);
    if (!phoneMatches) return [];

    // Deduplicate phones and create contacts
    const seenPhones = new Set<string>();

    for (const rawPhone of phoneMatches) {
      const phone = cleanPhone(rawPhone);
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);

      // Try to find context around the phone number for a name
      const phoneIndex = text.indexOf(rawPhone);
      const contextStart = Math.max(0, phoneIndex - 200);
      const context = text.substring(contextStart, phoneIndex);

      // Look for a name-like string near the phone
      // Try to find capitalized words (potential names)
      const nameMatch = context.match(/([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})\s*$/);
      const name = nameMatch
        ? nameMatch[1].trim()
        : `Síndico Google ${seenPhones.size}`;

      contacts.push({
        name,
        phone,
        fax: null,
        website: null,
        email: null,
        neighborhood: null,
        source: 'google_search',
        city,
        state,
      });
    }

    return contacts;
  } catch (err) {
    console.error('[GoogleSearch] Fallback error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ═══ MAIN EXPORT ═══
export async function scrapeGoogleSearch(options?: {
  maxResults?: number;
  cities?: string[];
}): Promise<ScrapedContact[]> {
  const maxResults = options?.maxResults || 15;
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  const useAPI = !!(apiKey && cx);

  if (!apiKey && !cx) {
    // No API key AND no CX — try fallback
    console.log('[GoogleSearch] No API key/CX configured, using HTML fallback...');
  } else if (useAPI) {
    console.log('[GoogleSearch] Using Custom Search API');
  } else {
    console.log('[GoogleSearch] Partial config (missing API key or CX), using HTML fallback...');
  }

  const queries = buildQueries(options?.cities);
  const allContacts: ScrapedContact[] = [];
  const seenPhones = new Set<string>();

  for (const query of queries) {
    if (allContacts.length >= maxResults) break;

    console.log(`[GoogleSearch] Query: "${query}"`);

    try {
      const contacts = useAPI
        ? await searchWithAPI(query, apiKey!, cx!)
        : await searchWithFallback(query);

      for (const contact of contacts) {
        if (!contact.phone || seenPhones.has(contact.phone)) continue;
        seenPhones.add(contact.phone);
        allContacts.push(contact);
      }

      console.log(`[GoogleSearch] Query returned ${contacts.length} contacts, ${allContacts.length} total unique`);

      // Small delay between queries to be respectful
      if (queries.indexOf(query) < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error(`[GoogleSearch] Query failed: "${query}"`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[GoogleSearch] Total: ${allContacts.length} contacts`);
  return allContacts.slice(0, maxResults);
}
