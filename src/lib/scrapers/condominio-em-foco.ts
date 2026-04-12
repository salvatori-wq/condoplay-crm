// ═══ SCRAPER: CondominioemFoco.com.br ═══
// Fonte GRATUITA com telefones de administradoras visíveis na página.
// ~27 administradoras em SP com telefone direto.
//
// Formato da página (markdown-like após strip HTML):
//   **Nome da Empresa**
//   São Paulo – Bairro
//   **Tel:** (011) 3884-9666
//   **Fax:** (011) 3884-9221
//   **Site:** www.exemplo.com.br

export interface ScrapedContact {
  name: string;
  phone: string | null;
  fax: string | null;
  website: string | null;
  email: string | null;
  neighborhood: string | null;
  source: string;
  city: string;
  state: string;
}

export async function scrapeCondominioemFoco(): Promise<ScrapedContact[]> {
  const url = 'https://condominioemfoco.com.br/administradoras/';
  const contacts: ScrapedContact[] = [];

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!res.ok) {
      console.error(`[CondominioemFoco] HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();

    // Strategy: strip HTML to text lines, then parse blocks
    const text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<hr[^>]*>/gi, '\n---\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#8211;/g, '–')
      .replace(/&#8217;/g, "'");

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Parse: find lines with Tel/Fone and look backwards for company name
    const seenNames = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match "Tel:" or "Fone:" lines with phone number
      const telMatch = line.match(/^(?:Tel|Fone)[:\s]*(\(0?\d{2,3}\)\s*[\d.-]+)/i);
      if (!telMatch) continue;

      const phone = cleanPhone(telMatch[1]);
      if (!phone || phone.length < 12) continue;

      // Look backwards for: company name (first non-label, non-location line)
      let companyName = '';
      let neighborhood = '';
      let fax: string | null = null;
      let website: string | null = null;

      // Scan backwards up to 5 lines for company name and bairro
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prev = lines[j];

        // Skip separators
        if (prev === '---' || prev === '* * *') continue;

        // Location line: "São Paulo – Bairro" or "Cidade – Bairro"
        if (prev.includes('–') && !neighborhood) {
          const parts = prev.split('–').map(p => p.trim());
          if (parts.length >= 2) {
            neighborhood = parts[parts.length - 1];
          }
          continue;
        }

        // Company name: not a label, has letters, reasonable length
        if (!companyName && isValidCompanyName(prev)) {
          companyName = prev;
          break;
        }
      }

      // Scan forward for Fax and Site
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 4); j++) {
        const next = lines[j];

        const faxMatch = next.match(/^Fax[:\s]*(\(0?\d{2,3}\)\s*[\d.-]+)/i);
        if (faxMatch && !fax) {
          fax = cleanPhone(faxMatch[1]);
        }

        const siteMatch = next.match(/^Site[:\s]*([\w.-]+\.com\.br)/i);
        if (siteMatch && !website) {
          website = siteMatch[1];
          if (!website.startsWith('http')) website = `https://${website}`;
        }

        // Stop at next company block (separator or another Tel line)
        if (next === '---' || next === '* * *') break;
        if (next.match(/^(?:Tel|Fone)[:\s]*\(/i) && j > i + 1) break;
      }

      if (!companyName) continue;
      if (seenNames.has(companyName)) continue;
      seenNames.add(companyName);

      contacts.push({
        name: companyName,
        phone,
        fax,
        website,
        email: null,
        neighborhood: neighborhood || null,
        source: 'condominioemfoco',
        city: 'São Paulo',
        state: 'SP',
      });
    }

    console.log(`[CondominioemFoco] Scraped ${contacts.length} contacts`);
    return contacts;
  } catch (err) {
    console.error('[CondominioemFoco] Scrape error:', err);
    return [];
  }
}

// Valida se o texto é um nome de empresa real
function isValidCompanyName(text: string): boolean {
  if (!text || text.length < 4 || text.length > 100) return false;

  // Rejeitar labels comuns
  const invalidPrefixes = [
    'fax', 'tel', 'fone', 'telefone', 'bairro', 'site', 'email',
    'endereco', 'endereço', 'cep', 'contato', 'www', 'http', '---',
  ];
  const lower = text.toLowerCase().replace(/[:\s]+$/, '');
  if (invalidPrefixes.some(p => lower === p || lower.startsWith(p + ':'))) return false;

  // Rejeitar se for só números, parênteses, pontos
  if (/^[\d\s().+-]+$/.test(text)) return false;

  // Deve ter pelo menos 3 letras
  if ((text.match(/[a-zA-ZÀ-ÿ]/g) || []).length < 3) return false;

  return true;
}

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
