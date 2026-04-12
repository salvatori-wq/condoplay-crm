// ═══ SCRAPER: Google Maps — Administradoras de Condomínios ═══
// Usa a API pública do Google Maps (Places) para buscar administradoras
// de condomínios em cidades-alvo. Extrai nome, telefone, website.
// GRATUITO: usa endpoint não-autenticado (limitado, mas funcional para 10/dia).

import type { ScrapedContact } from './condominio-em-foco';

interface PlaceResult {
  name: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  formatted_address?: string;
  vicinity?: string;
  place_id?: string;
  business_status?: string;
}

// Queries otimizadas para encontrar administradoras/síndicos
const SEARCH_QUERIES = [
  'administradora de condominios',
  'sindico profissional',
  'gestao condominial',
  'administracao de condominios',
];

const TARGET_CITIES = [
  { city: 'Sao Paulo', state: 'SP', lat: -23.5505, lng: -46.6333 },
  { city: 'Rio de Janeiro', state: 'RJ', lat: -22.9068, lng: -43.1729 },
  { city: 'Belo Horizonte', state: 'MG', lat: -19.9167, lng: -43.9345 },
  { city: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733 },
  { city: 'Campinas', state: 'SP', lat: -22.9099, lng: -47.0626 },
  { city: 'Porto Alegre', state: 'RS', lat: -30.0346, lng: -51.2177 },
  { city: 'Salvador', state: 'BA', lat: -12.9714, lng: -38.5124 },
  { city: 'Goiania', state: 'GO', lat: -16.6869, lng: -49.2648 },
];

// ═══ SCRAPE VIA GOOGLE SEARCH (sem API key) ═══
// Faz scraping do Google Search para encontrar administradoras com telefone

export async function scrapeGoogleMaps(options?: {
  maxResults?: number;
  cities?: string[];
}): Promise<ScrapedContact[]> {
  const maxResults = options?.maxResults || 15;
  const contacts: ScrapedContact[] = [];
  const seenPhones = new Set<string>();

  console.log('[GoogleMaps] Starting search for administradoras...');

  // Strategy: Search Google for "administradora de condominios [cidade] telefone"
  for (const cityInfo of TARGET_CITIES) {
    if (contacts.length >= maxResults) break;

    // Filtrar por cidades específicas se fornecido
    if (options?.cities && !options.cities.some(c =>
      cityInfo.city.toLowerCase().includes(c.toLowerCase())
    )) continue;

    for (const query of SEARCH_QUERIES.slice(0, 2)) { // Limitar queries por cidade
      if (contacts.length >= maxResults) break;

      try {
        const results = await searchGoogleForContacts(
          `${query} ${cityInfo.city} telefone contato`,
          cityInfo
        );

        for (const result of results) {
          if (contacts.length >= maxResults) break;
          if (result.phone && !seenPhones.has(result.phone)) {
            seenPhones.add(result.phone);
            contacts.push(result);
          }
        }
      } catch (err) {
        console.error(`[GoogleMaps] Error searching ${cityInfo.city}:`, err);
      }

      // Rate limiting — espera entre requests
      await sleep(2000 + Math.random() * 3000);
    }
  }

  console.log(`[GoogleMaps] Found ${contacts.length} contacts`);
  return contacts;
}

// ═══ SEARCH GOOGLE AND EXTRACT CONTACTS ═══

async function searchGoogleForContacts(
  query: string,
  cityInfo: { city: string; state: string }
): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];

  // Use Google Search to find business listings with phone numbers
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=pt-BR`;

  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
    },
  });

  if (!res.ok) {
    console.error(`[GoogleMaps] Google search HTTP ${res.status}`);
    return [];
  }

  const html = await res.text();

  // Extract phone numbers and associated business names from search results
  // Google often shows business info cards with phone numbers
  const phoneRegex = /\(0?[1-9]\d\)\s*\d{4,5}[.-]?\d{4}/g;
  const phones = html.match(phoneRegex) || [];

  // Extract structured snippets — look for business names near phones
  // Pattern: text blocks containing company name + phone
  const snippetRegex = /(?:class="[^"]*">)([^<]{5,60})<[^>]*>[^<]*(?:\(0?\d{2}\)\s*[\d.-]+)/g;
  let match;

  while ((match = snippetRegex.exec(html)) !== null) {
    const name = cleanBusinessName(match[1]);
    const phoneMatch = match[0].match(/\(0?\d{2}\)\s*[\d.-]+/);

    if (name && phoneMatch) {
      const phone = cleanPhone(phoneMatch[0]);
      if (phone && isValidBrazilianPhone(phone)) {
        contacts.push({
          name,
          phone,
          fax: null,
          website: null,
          email: null,
          neighborhood: null,
          source: 'google_maps',
          city: 'São Paulo',
          state: 'SP',
        });
      }
    }
  }

  // Fallback: extract all phones and try to match with nearby text
  if (contacts.length === 0 && phones.length > 0) {
    const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    for (const phoneRaw of phones.slice(0, 5)) {
      const phoneIdx = textContent.indexOf(phoneRaw);
      if (phoneIdx === -1) continue;

      // Look for business name in surrounding text (200 chars before)
      const before = textContent.substring(Math.max(0, phoneIdx - 200), phoneIdx);
      const nameMatch = before.match(/([A-Z][a-záéíóúãõâêîôûç\s&]+(?:Ltda|LTDA|SA|S\.A\.|ME|EPP|EIRELI|Administra\w+|Condo\w+|Gestão|Gestao))/i);

      if (nameMatch) {
        const name = cleanBusinessName(nameMatch[1]);
        const phone = cleanPhone(phoneRaw);

        if (name && phone && isValidBrazilianPhone(phone)) {
          contacts.push({
            name,
            phone,
            fax: null,
            website: null,
            email: null,
            neighborhood: null,
            source: 'google_maps',
            city: cityInfo.city,
            state: cityInfo.state,
          });
        }
      }
    }
  }

  return contacts;
}

// ═══ ALTERNATIVE: Google Maps Places Text Search (needs API key) ═══
// Se o user configurar GOOGLE_MAPS_API_KEY, usa a API oficial (mais confiável)

export async function scrapeGoogleMapsAPI(apiKey: string, options?: {
  maxResults?: number;
}): Promise<ScrapedContact[]> {
  const maxResults = options?.maxResults || 15;
  const contacts: ScrapedContact[] = [];
  const seenPhones = new Set<string>();

  for (const cityInfo of TARGET_CITIES) {
    if (contacts.length >= maxResults) break;

    for (const query of SEARCH_QUERIES.slice(0, 1)) {
      if (contacts.length >= maxResults) break;

      try {
        // Text Search
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + cityInfo.city)}&language=pt-BR&key=${apiKey}`;

        const res = await fetch(searchUrl);
        if (!res.ok) continue;

        const data = await res.json();
        const places = data.results || [];

        // Get details for each place (to get phone number)
        for (const place of places.slice(0, 5)) {
          if (contacts.length >= maxResults) break;

          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,international_phone_number,website,formatted_address&language=pt-BR&key=${apiKey}`;

          const detailRes = await fetch(detailUrl);
          if (!detailRes.ok) continue;

          const detailData = await detailRes.json();
          const detail: PlaceResult = detailData.result;

          if (detail?.international_phone_number || detail?.formatted_phone_number) {
            const phone = cleanPhone(detail.international_phone_number || detail.formatted_phone_number || '');

            if (phone && !seenPhones.has(phone)) {
              seenPhones.add(phone);
              contacts.push({
                name: detail.name || place.name,
                phone,
                fax: null,
                website: detail.website || null,
                email: null,
                neighborhood: null,
                source: 'google_maps_api',
                city: cityInfo.city,
                state: cityInfo.state,
              });
            }
          }

          await sleep(200); // Rate limit
        }
      } catch (err) {
        console.error(`[GoogleMapsAPI] Error:`, err);
      }
    }
  }

  return contacts;
}

// ═══ HELPERS ═══

function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  // Remove leading 0 from area code
  if (digits.startsWith('0')) digits = digits.substring(1);

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

function cleanBusinessName(raw: string): string {
  return raw
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[^a-zA-ZÀ-ÿ]+/, '') // Remove leading non-alpha
    .replace(/[^a-zA-ZÀ-ÿ\s&.]+$/, '') // Remove trailing non-alpha
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
