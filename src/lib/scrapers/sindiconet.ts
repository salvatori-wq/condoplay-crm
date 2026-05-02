// ═══ SCRAPER: SindicoNet/CoteiBem — Diretorio de Sindicos/Administradoras ═══
// O SindicoNet migrou o diretorio para coteibem.sindiconet.com.br.
// Estrategia: 1) Lista empresas na pagina de categoria+cidade (20 por pagina)
//             2) Visita cada perfil individual para extrair telefone/email/endereco
//             3) Dados de contato vem do JSON-LD (Schema.org) embutido na pagina

import type { ScrapedContact } from './condominio-em-foco';

// Cidades-alvo ordenadas por tamanho de mercado
const TARGET_CITIES = [
  { city: 'Sao Paulo', state: 'SP', stateCode: 'sp', slug: 'sao-paulo' },
  { city: 'Rio de Janeiro', state: 'RJ', stateCode: 'rj', slug: 'rio-de-janeiro' },
  { city: 'Belo Horizonte', state: 'MG', stateCode: 'mg', slug: 'belo-horizonte' },
  { city: 'Curitiba', state: 'PR', stateCode: 'pr', slug: 'curitiba' },
  { city: 'Porto Alegre', state: 'RS', stateCode: 'rs', slug: 'porto-alegre' },
  { city: 'Campinas', state: 'SP', stateCode: 'sp', slug: 'campinas' },
  { city: 'Salvador', state: 'BA', stateCode: 'ba', slug: 'salvador' },
  { city: 'Goiania', state: 'GO', stateCode: 'go', slug: 'goiania' },
  { city: 'Brasilia', state: 'DF', stateCode: 'df', slug: 'brasilia' },
  { city: 'Florianopolis', state: 'SC', stateCode: 'sc', slug: 'florianopolis' },
];

const BASE_URL = 'https://coteibem.sindiconet.com.br';

// Categories to scrape
const CATEGORIES = [
  'administradoras-condominios',
  'sindicos-profissionais',
];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.5,en;q=0.3',
  Connection: 'keep-alive',
  'Cache-Control': 'no-cache',
};

// ═══ MAIN EXPORT ═══

export async function scrapeSindicoNet(options?: {
  maxResults?: number;
  cities?: string[];
}): Promise<ScrapedContact[]> {
  const maxResults = options?.maxResults || 15;
  const contacts: ScrapedContact[] = [];
  const seenPhones = new Set<string>();

  console.log(`[SindicoNet] Starting scrape — target: ${maxResults} contacts`);

  for (const cityInfo of TARGET_CITIES) {
    if (contacts.length >= maxResults) break;

    // Filter by specific cities if provided
    if (
      options?.cities &&
      !options.cities.some((c) => cityInfo.city.toLowerCase().includes(c.toLowerCase()))
    ) {
      continue;
    }

    try {
      const cityContacts = await scrapeCityListings(cityInfo, maxResults - contacts.length);

      for (const contact of cityContacts) {
        if (contacts.length >= maxResults) break;

        const normalizedPhone = contact.phone?.replace(/\D/g, '') || '';
        if (!normalizedPhone) continue;
        if (seenPhones.has(normalizedPhone)) continue;

        seenPhones.add(normalizedPhone);
        contacts.push(contact);
      }

      console.log(
        `[SindicoNet] ${cityInfo.city}: found ${cityContacts.length} raw, ` +
          `${contacts.length} unique total`
      );
    } catch (err) {
      console.error(
        `[SindicoNet] Error scraping ${cityInfo.city}:`,
        err instanceof Error ? err.message : String(err)
      );
    }

    // Rate limiting: 1-2s between city requests
    await sleep(1000 + Math.random() * 1000);
  }

  console.log(`[SindicoNet] Done — ${contacts.length} unique contacts`);
  return contacts;
}

// ═══ SCRAPE CITY LISTINGS ═══
// Step 1: Get company profile slugs from listing pages
// Step 2: Visit each profile page to extract contact data from JSON-LD

async function scrapeCityListings(
  cityInfo: { city: string; state: string; stateCode: string; slug: string },
  remaining: number
): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];
  const visitedSlugs = new Set<string>();

  for (const category of CATEGORIES) {
    if (contacts.length >= remaining) break;

    let page = 1;
    const maxPages = 2; // 2 pages x 20 results = up to 40 slugs per category

    while (page <= maxPages && contacts.length < remaining) {
      const url =
        page === 1
          ? `${BASE_URL}/fornecedores/${category}/${cityInfo.stateCode}/${cityInfo.slug}`
          : `${BASE_URL}/fornecedores/${category}/${cityInfo.stateCode}/${cityInfo.slug}?page=${page}`;

      try {
        const html = await fetchPage(url);
        if (!html) break;

        const slugs = extractProfileSlugs(html);

        if (slugs.length === 0) {
          break;
        }

        console.log(`[SindicoNet] ${cityInfo.city}/${category} page ${page}: ${slugs.length} profiles found`);

        // Visit each profile page
        for (const slug of slugs) {
          if (contacts.length >= remaining) break;
          if (visitedSlugs.has(slug)) continue;
          visitedSlugs.add(slug);

          try {
            const contact = await scrapeProfilePage(slug, cityInfo);
            if (contact && contact.phone) {
              contacts.push(contact);
            }
          } catch (err) {
            console.error(
              `[SindicoNet] Error scraping profile ${slug}:`,
              err instanceof Error ? err.message : String(err)
            );
          }

          // Rate limiting between profile requests
          await sleep(800 + Math.random() * 700);
        }

        // Check if there might be more pages
        if (slugs.length < 15 || !hasNextPage(html)) break;

        page++;
        await sleep(1500 + Math.random() * 500);
      } catch (err) {
        console.error(
          `[SindicoNet] Error fetching listing ${url}:`,
          err instanceof Error ? err.message : String(err)
        );
        break;
      }
    }

    // Rate limiting between categories
    if (CATEGORIES.indexOf(category) < CATEGORIES.length - 1) {
      await sleep(1000 + Math.random() * 1000);
    }
  }

  return contacts;
}

// ═══ EXTRACT PROFILE SLUGS FROM LISTING PAGE ═══

function extractProfileSlugs(html: string): string[] {
  const slugs: string[] = [];
  const seen = new Set<string>();

  // Match links to /fornecedor/{slug}
  const regex = /\/fornecedor\/([a-z0-9][\w-]+)/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const slug = match[1].toLowerCase();

    // Skip non-company slugs
    if (seen.has(slug)) continue;
    if (slug.length < 3) continue;

    seen.add(slug);
    slugs.push(slug);
  }

  return slugs;
}

// ═══ SCRAPE INDIVIDUAL PROFILE PAGE ═══
// Contact data is in JSON-LD (Schema.org) structured data

async function scrapeProfilePage(
  slug: string,
  cityInfo: { city: string; state: string }
): Promise<ScrapedContact | null> {
  const url = `${BASE_URL}/fornecedor/${slug}`;
  const html = await fetchPage(url);
  if (!html) return null;

  // Strategy 1: Extract from JSON-LD (most reliable)
  const contact = extractFromJsonLd(html, cityInfo);
  if (contact) return contact;

  // Strategy 2: Regex fallback for phone/name in raw HTML
  return extractFromHtml(html, cityInfo);
}

// ═══ JSON-LD EXTRACTION ═══

function extractFromJsonLd(
  html: string,
  cityInfo: { city: string; state: string }
): ScrapedContact | null {
  // Find all JSON-LD blocks
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const contact = parseJsonLdBlock(data, cityInfo);
      if (contact) return contact;
    } catch {
      // Invalid JSON, skip
    }
  }

  return null;
}

function parseJsonLdBlock(
  data: Record<string, unknown>,
  cityInfo: { city: string; state: string }
): ScrapedContact | null {
  // Handle @graph arrays
  if (data['@graph'] && Array.isArray(data['@graph'])) {
    for (const item of data['@graph'] as Record<string, unknown>[]) {
      const contact = parseJsonLdBlock(item, cityInfo);
      if (contact) return contact;
    }
    return null;
  }

  // We want Organization, LocalBusiness, or similar types
  const type = String(data['@type'] || '');
  if (!type.match(/Organization|LocalBusiness|ProfessionalService|HomeAndConstructionBusiness/i)) {
    return null;
  }

  const name = String(data.name || '');
  if (!name || name.length < 2) return null;

  // Extract phone
  let phone: string | null = null;
  const rawPhone = String(data.telephone || '');
  if (rawPhone) {
    phone = cleanPhone(rawPhone);
    if (!isValidBrazilianPhone(phone)) {
      phone = null;
    }
  }

  // Extract address
  let neighborhood: string | null = null;
  let city = cityInfo.city;
  let state = cityInfo.state;

  const address = data.address as Record<string, unknown> | undefined;
  if (address) {
    if (address.addressLocality) city = String(address.addressLocality);
    if (address.addressRegion) state = String(address.addressRegion);
    // Neighborhood sometimes in streetAddress
    const street = String(address.streetAddress || '');
    const neighborhoodMatch = street.match(/,\s*([A-ZÀ-Ú][^,]{2,30})$/i);
    if (neighborhoodMatch) {
      neighborhood = neighborhoodMatch[1].trim();
    }
  }

  // Extract website
  let website: string | null = null;
  if (data.url && !String(data.url).includes('sindiconet') && !String(data.url).includes('coteibem')) {
    website = String(data.url);
  }
  if (!website && data.sameAs) {
    const sameAs = Array.isArray(data.sameAs) ? data.sameAs : [data.sameAs];
    for (const url of sameAs) {
      const urlStr = String(url);
      if (urlStr.startsWith('http') && !urlStr.includes('sindiconet') && !urlStr.includes('coteibem')) {
        website = urlStr;
        break;
      }
    }
  }

  // Extract email
  let email: string | null = null;
  if (data.email) {
    const emailStr = String(data.email).toLowerCase();
    if (
      emailStr.includes('@') &&
      !emailStr.includes('sindiconet') &&
      !emailStr.includes('coteibem') &&
      !emailStr.includes('noreply')
    ) {
      email = emailStr;
    }
  }

  return {
    name: cleanText(name),
    phone,
    fax: null,
    website,
    email,
    neighborhood,
    source: 'sindiconet',
    city,
    state,
  };
}

// ═══ HTML FALLBACK EXTRACTION ═══

function extractFromHtml(
  html: string,
  cityInfo: { city: string; state: string }
): ScrapedContact | null {
  // Try to find a phone number anywhere in the page
  const phoneRegex = /\+?55?\s*\(?0?([1-9]\d)\)?\s*(\d{4,5})[.\-\s]?(\d{4})/;
  const phoneMatch = html.match(phoneRegex);
  if (!phoneMatch) return null;

  const phone = cleanPhone(phoneMatch[0]);
  if (!isValidBrazilianPhone(phone)) return null;

  // Try to find company name from <title> or <h1>
  let name: string | null = null;

  const titleMatch = html.match(/<title[^>]*>([^<]{3,100})<\/title>/i);
  if (titleMatch) {
    // Title usually has format "Company Name - CoteiBem" or "Company Name | SindicoNet"
    name = titleMatch[1].split(/[-|–—]/)[0].trim();
  }

  if (!name) {
    const h1Match = html.match(/<h1[^>]*>([^<]{3,100})<\/h1>/i);
    if (h1Match) name = cleanText(h1Match[1]);
  }

  if (!name) return null;

  // Try email
  let email: string | null = null;
  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    const emailStr = emailMatch[0].toLowerCase();
    if (!emailStr.includes('sindiconet') && !emailStr.includes('coteibem') && !emailStr.includes('noreply')) {
      email = emailStr;
    }
  }

  return {
    name: cleanText(name),
    phone,
    fax: null,
    website: null,
    email,
    neighborhood: null,
    source: 'sindiconet',
    city: cityInfo.city,
    state: cityInfo.state,
  };
}

// ═══ FETCH PAGE WITH RETRY ═══

async function fetchPage(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[SindicoNet] Fetching: ${url}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);

      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 404) {
        console.log(`[SindicoNet] 404 for ${url} — skipping`);
        return null;
      }

      if (!res.ok) {
        console.warn(`[SindicoNet] HTTP ${res.status} for ${url}`);
        if (attempt < 2) {
          await sleep(3000);
          continue;
        }
        return null;
      }

      return await res.text();
    } catch (err) {
      if (attempt < 2) {
        console.warn(`[SindicoNet] Fetch error (retrying): ${err instanceof Error ? err.message : err}`);
        await sleep(3000);
      } else {
        throw err;
      }
    }
  }

  return null;
}

// ═══ PAGINATION CHECK ═══

function hasNextPage(html: string): boolean {
  // CoteiBem uses ?page=N for pagination
  return /\?page=\d/i.test(html);
}

// ═══ PHONE/TEXT HELPERS ═══

function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  // Remove leading 0 from area code (e.g., 011 -> 11)
  if (digits.startsWith('550')) {
    digits = '55' + digits.substring(3);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Add country code if missing
  if (!digits.startsWith('55')) digits = `55${digits}`;

  return digits;
}

function isValidBrazilianPhone(digits: string): boolean {
  // Must be 55 + 2 digit DDD + 8-9 digit number = 12-13 digits
  if (digits.length < 12 || digits.length > 13) return false;
  if (!digits.startsWith('55')) return false;

  const ddd = parseInt(digits.substring(2, 4));
  if (ddd < 11 || ddd > 99) return false;

  return true;
}

function cleanText(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
