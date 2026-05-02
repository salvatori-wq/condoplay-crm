// ═══ SCRAPER ORCHESTRATOR — Unifica todas as fontes gratuitas ═══
// Ordem de prioridade:
//   1. CondominioemFoco (telefones diretos, mais confiável)
//   2. CNPJ Enrichment (dados públicos Receita Federal)
//   3. SindicoNet (diretório de síndicos/administradoras)
//   4. Google Search (Custom Search API ou fallback HTML)
//
// Deduplicação por telefone. Meta: 10-15 contatos/dia.

import { scrapeCondominioemFoco, type ScrapedContact } from './condominio-em-foco';
import { scrapeCnpjEnrichment } from './cnpj-enrichment';
import { scrapeSindicoNet } from './sindiconet';
import { scrapeGoogleSearch } from './google-search';

export type { ScrapedContact } from './condominio-em-foco';

export interface ScraperResult {
  contacts: ScrapedContact[];
  sources: {
    condominioemfoco: number;
    cnpj: number;
    sindiconet: number;
    google: number;
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
  const sources = { condominioemfoco: 0, cnpj: 0, sindiconet: 0, google: 0 };

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

  // ═══ 3. SindicoNet (fallback para completar a meta) ═══
  if (!skip.has('sindiconet') && allContacts.length < target) {
    try {
      console.log('[Orchestrator] Running SindicoNet scraper...');
      const snContacts = await scrapeSindicoNet({
        maxResults: target - allContacts.length + 3,
      });
      addContacts(snContacts, 'sindiconet');
      console.log(`[Orchestrator] SindicoNet: ${snContacts.length} found, ${sources.sindiconet} unique`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`SindicoNet: ${msg}`);
      console.error('[Orchestrator] SindicoNet error:', msg);
    }
  }

  // ═══ 4. Google Search (free tier: 100 queries/dia, 2-3 por run) ═══
  if (!skip.has('google') && allContacts.length < target) {
    try {
      console.log('[Orchestrator] Running Google Search scraper...');
      const googleContacts = await scrapeGoogleSearch({
        maxResults: target - allContacts.length + 3,
      });
      addContacts(googleContacts, 'google');
      console.log(`[Orchestrator] Google: ${googleContacts.length} found, ${sources.google} unique`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Google Search: ${msg}`);
      console.error('[Orchestrator] Google Search error:', msg);
    }
  }

  const elapsed_ms = Date.now() - startTime;

  console.log(`[Orchestrator] Total: ${allContacts.length} unique contacts in ${(elapsed_ms / 1000).toFixed(1)}s`);
  console.log(`[Orchestrator] Sources: Foco=${sources.condominioemfoco}, CNPJ=${sources.cnpj}, SindicoNet=${sources.sindiconet}, Google=${sources.google}`);

  return {
    contacts: allContacts.slice(0, target), // Limita à meta
    sources,
    errors,
    elapsed_ms,
  };
}
