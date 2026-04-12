// ═══ SCRAPER: CNPJ Enrichment — BrasilAPI + ReceitaWS ═══
// Busca administradoras de condomínios por CNAE e enriquece com telefone.
// Fontes 100% gratuitas, dados públicos da Receita Federal.
//
// CNAE targets:
//   6822-6/00 — Gestão e administração da propriedade imobiliária
//   8112-5/00 — Condomínios prediais (administração)
//   6821-8/01 — Corretagem na compra/venda de imóveis
//
// Fluxo:
//   1. Busca CNPJs por CNAE + cidade via CNPJ.ws ou BrasilAPI
//   2. Para cada CNPJ, consulta dados completos (telefone, email, endereço)
//   3. Retorna contatos com telefone válido

import type { ScrapedContact } from './condominio-em-foco';

// CNAEs de administradoras de condomínios
const TARGET_CNAES = [
  '6822600', // Gestão e administração da propriedade imobiliária
  '8112500', // Condomínios prediais
];

const TARGET_CITIES_UF: Array<{ city: string; state: string; uf: string }> = [
  { city: 'São Paulo', state: 'SP', uf: 'SP' },
];

// ═══ MAIN: Busca e enriquece CNPJs ═══

export async function scrapeCnpjEnrichment(options?: {
  maxResults?: number;
  states?: string[];
}): Promise<ScrapedContact[]> {
  const maxResults = options?.maxResults || 15;
  const contacts: ScrapedContact[] = [];
  const seenCnpjs = new Set<string>();

  console.log('[CNPJ] Starting CNPJ enrichment search...');

  for (const cityInfo of TARGET_CITIES_UF) {
    if (contacts.length >= maxResults) break;

    // Filtrar por estados específicos se fornecido
    if (options?.states && !options.states.includes(cityInfo.uf)) continue;

    for (const cnae of TARGET_CNAES) {
      if (contacts.length >= maxResults) break;

      try {
        // Tenta CNPJ.ws primeiro (mais completo, 3 req/min gratis)
        const cnpjs = await searchCnpjWs(cnae, cityInfo.uf, cityInfo.city);

        for (const cnpj of cnpjs) {
          if (contacts.length >= maxResults) break;
          if (seenCnpjs.has(cnpj)) continue;
          seenCnpjs.add(cnpj);

          // Enriquece via BrasilAPI (sem rate limit severo)
          const contact = await enrichViaBrasilAPI(cnpj, cityInfo);
          if (contact && contact.phone) {
            contacts.push(contact);
          }

          // Rate limiting
          await sleep(1500 + Math.random() * 1500);
        }
      } catch (err) {
        console.error(`[CNPJ] Error for ${cityInfo.city}/${cnae}:`, err);
      }

      await sleep(2000);
    }
  }

  // Fallback: se não achou via CNPJ.ws, tenta busca direta
  if (contacts.length < 5) {
    console.log('[CNPJ] Few results, trying direct BrasilAPI search...');
    const fallbackContacts = await searchDirectBrasilAPI(maxResults - contacts.length);
    contacts.push(...fallbackContacts);
  }

  console.log(`[CNPJ] Found ${contacts.length} contacts with phone`);
  return contacts;
}

// ═══ CNPJ.WS — Busca por CNAE + UF ═══

async function searchCnpjWs(cnae: string, uf: string, city: string): Promise<string[]> {
  // cnpj.ws API pública — busca empresas por CNAE e estado
  // Endpoint: GET /cnpjs?cnae={cnae}&uf={uf}
  const url = `https://publica.cnpj.ws/cnpj?cnae=${cnae}&uf=${uf}&municipio=${encodeURIComponent(city)}&page=1`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      // CNPJ.ws pode retornar 429 (rate limit) ou 403
      if (res.status === 429) {
        console.log('[CNPJ.ws] Rate limited, waiting...');
        await sleep(60000); // Espera 1 min
      }
      return [];
    }

    const data = await res.json();

    // Extrai CNPJs da resposta
    if (Array.isArray(data)) {
      return data.map((item: { cnpj?: string }) => item.cnpj || '').filter(Boolean);
    }
    if (data.registros && Array.isArray(data.registros)) {
      return data.registros.map((item: { cnpj?: string }) => item.cnpj || '').filter(Boolean);
    }
    if (data.cnpj) {
      return [data.cnpj];
    }

    return [];
  } catch {
    return [];
  }
}

// ═══ BRASIL API — Enriquecimento por CNPJ ═══

async function enrichViaBrasilAPI(
  cnpj: string,
  cityInfo: { city: string; state: string }
): Promise<ScrapedContact | null> {
  // BrasilAPI — dados completos da Receita Federal, grátis
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 429) await sleep(5000);
      return null;
    }

    const data = await res.json();

    // Verificar se está ativa
    if (data.descricao_situacao_cadastral !== 'ATIVA') return null;

    // Extrair telefone
    const phone = cleanPhone(data.ddd_telefone_1 || data.ddd_telefone_2 || '');
    if (!phone) return null;

    // Nome fantasia ou razão social
    const name = data.nome_fantasia || data.razao_social || '';
    if (!name) return null;

    return {
      name: formatCompanyName(name),
      phone,
      fax: data.ddd_telefone_2 ? cleanPhone(data.ddd_telefone_2) : null,
      website: null,
      email: data.email ? data.email.toLowerCase() : null,
      neighborhood: data.bairro || null,
      source: 'cnpj_receita',
      city: data.municipio || cityInfo.city,
      state: data.uf || cityInfo.state,
    };
  } catch {
    return null;
  }
}

// ═══ RECEITA WS — Backup enrichment ═══

async function enrichViaReceitaWS(cnpj: string, cityInfo: { city: string; state: string }): Promise<ScrapedContact | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const url = `https://receitaws.com.br/v1/cnpj/${cleanCnpj}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 'ERROR') return null;
    if (data.situacao !== 'ATIVA') return null;

    const phone = cleanPhone(data.telefone || '');
    if (!phone) return null;

    const name = data.fantasia || data.nome || '';
    if (!name) return null;

    return {
      name: formatCompanyName(name),
      phone,
      fax: null,
      website: null,
      email: data.email ? data.email.toLowerCase() : null,
      neighborhood: data.bairro || null,
      source: 'cnpj_receita',
      city: data.municipio || cityInfo.city,
      state: data.uf || cityInfo.state,
    };
  } catch {
    return null;
  }
}

// ═══ DIRECT SEARCH — BrasilAPI com CNPJs conhecidos ═══
// Usa lista de CNPJs de administradoras conhecidas para enriquecer

async function searchDirectBrasilAPI(maxResults: number): Promise<ScrapedContact[]> {
  const contacts: ScrapedContact[] = [];

  // CNPJs de administradoras conhecidas em SP (dados públicos da Receita Federal)
  // Encontrados via busca pública de empresas CNAE 6822-6/00 em São Paulo
  const knownCnpjs: string[] = [
    // Estes são exemplos — em produção, popular via scraping de listas públicas
    // A cada run do HAWKEYE, novos CNPJs são descobertos e salvos
  ];

  for (const cnpj of knownCnpjs) {
    if (contacts.length >= maxResults) break;

    const contact = await enrichViaBrasilAPI(cnpj, { city: 'Sao Paulo', state: 'SP' });
    if (contact) contacts.push(contact);

    await sleep(1500);
  }

  return contacts;
}

// ═══ PUBLIC CNPJ SEARCH — Busca aberta por nome ═══
// Busca empresas por nome/atividade nos registros públicos

export async function searchByCompanyName(
  name: string,
  uf?: string
): Promise<ScrapedContact | null> {
  // Tenta BrasilAPI primeiro
  // A BrasilAPI não tem busca por nome, mas a CNPJ.ws tem
  const searchUrl = `https://publica.cnpj.ws/cnpj?nome=${encodeURIComponent(name)}${uf ? `&uf=${uf}` : ''}&page=1`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const firstResult = Array.isArray(data) ? data[0] : data?.registros?.[0];

    if (!firstResult?.cnpj) return null;

    // Enriquece o primeiro resultado
    return await enrichViaBrasilAPI(firstResult.cnpj, { city: '', state: uf || '' });
  } catch {
    return null;
  }
}

// ═══ HELPERS ═══

function cleanPhone(raw: string): string {
  if (!raw) return '';

  let digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 10) return '';

  // Remove leading 0 from area code
  if (digits.startsWith('0')) digits = digits.substring(1);

  // Add country code if missing
  if (!digits.startsWith('55')) digits = `55${digits}`;

  // Validate length (55 + DDD + number = 12-13 digits)
  if (digits.length < 12 || digits.length > 13) return '';

  return digits;
}

function formatCompanyName(name: string): string {
  // Capitaliza corretamente nomes que vêm em MAIÚSCULAS da Receita
  if (name === name.toUpperCase() && name.length > 3) {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (['de', 'da', 'do', 'das', 'dos', 'e', 'em'].includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
  return name;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
