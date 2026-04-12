// ═══ SCRAPER ORCHESTRATOR — Unifica todas as fontes gratuitas ═══
// Ordem de prioridade:
//   1. CondominioemFoco (telefones diretos, mais confiável)
//   2. CNPJ Enrichment (dados públicos Receita Federal)
//   3. Google Maps (maior volume, menos preciso)
//
// Deduplicação por telefone. Meta: 10-15 contatos/dia.

import { scrapeCondominioemFoco, type ScrapedContact } from './condominio-em-foco';
import { scrapeCnpjEnrichment } from './cnpj-enrichment';
import { scrapeGoogleMaps } from './google-maps';

export type { ScrapedContact } from './condominio-em-foco';

export interface ScraperResult {
  contacts: ScrapedContact[];
  sources: {
    condominioemfoco: number;
    cnpj: number;
    google_maps: number;
  };
  errors: string[];
  elapsed_ms: number;
}

export async function runAllScrapers(options?: {
  target?: number; // Meta de contatos (default: 12)
  skipSources?: string[]; // Pular fontes específicas
}): Promise<ScraperResult> {
  const target = options?.target || 12;
  const skip = new Set(options?.skipSources || []);
  const startTime = Date.now();

  const allContacts: ScrapedContact[] = [];
  const seenPhones = new Set<string>();
  const errors: string[] = [];
  const sources = { condominioemfoco: 0, cnpj: 0, google_maps: 0 };

  // Helper: adiciona contatos sem duplicatas
  const addContacts = (contacts: ScrapedContact[], sourceName: keyof typeof sources) => {
    for (const contact of contacts) {
      if (!contact.phone) continue;
      const normalizedPhone = contact.phone.replace(/\D/g, '');
      if (seenPhones.has(normalizedPhone)) continue;
      seenPhones.add(normalizedPhone);
      allContacts.push(contact);
      sources[sourceName]++;
    }
  };

  // ═══ 1. CondominioemFoco (mais confiável) ═══
  if (!skip.has('condominioemfoco')) {
    try {
      console.log('[Orchestrator] Running CondominioemFoco scraper...');
      const focoContacts = await scrapeCondominioemFoco();
      addContacts(focoContacts, 'condominioemfoco');
      console.log(`[Orchestrator] CondominioemFoco: ${focoContacts.length} found, ${sources.condominioemfoco} unique`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`CondominioemFoco: ${msg}`);
      console.error('[Orchestrator] CondominioemFoco error:', msg);
    }
  }

  // ═══ 2. CNPJ Enrichment (se precisa de mais) ═══
  if (!skip.has('cnpj') && allContacts.length < target) {
    try {
      console.log('[Orchestrator] Running CNPJ enrichment...');
      const cnpjContacts = await scrapeCnpjEnrichment({
        maxResults: target - allContacts.length + 3, // Buffer
      });
      addContacts(cnpjContacts, 'cnpj');
      console.log(`[Orchestrator] CNPJ: ${cnpjContacts.length} found, ${sources.cnpj} unique`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`CNPJ: ${msg}`);
      console.error('[Orchestrator] CNPJ error:', msg);
    }
  }

  // ═══ 3. Google Maps (fallback para completar a meta) ═══
  if (!skip.has('google_maps') && allContacts.length < target) {
    try {
      console.log('[Orchestrator] Running Google Maps scraper...');
      const gmContacts = await scrapeGoogleMaps({
        maxResults: target - allContacts.length + 3,
      });
      addContacts(gmContacts, 'google_maps');
      console.log(`[Orchestrator] GoogleMaps: ${gmContacts.length} found, ${sources.google_maps} unique`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`GoogleMaps: ${msg}`);
      console.error('[Orchestrator] GoogleMaps error:', msg);
    }
  }

  const elapsed_ms = Date.now() - startTime;

  console.log(`[Orchestrator] Total: ${allContacts.length} unique contacts in ${(elapsed_ms / 1000).toFixed(1)}s`);
  console.log(`[Orchestrator] Sources: Foco=${sources.condominioemfoco}, CNPJ=${sources.cnpj}, GMaps=${sources.google_maps}`);

  return {
    contacts: allContacts.slice(0, target), // Limita à meta
    sources,
    errors,
    elapsed_ms,
  };
}
