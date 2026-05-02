// ═══ HAWKEYE — Agente de Prospeccao Diaria ═══
// Roda todo dia comercial as 8h. Encontra 10 sindicos via scrapers gratuitos.
// Salva leads no CRM e agenda LOKI para iniciar contato.
//
// Fontes (prioridade):
//   1. CondominioemFoco.com.br — telefones diretos de administradoras
//   2. CNPJ Enrichment — BrasilAPI/ReceitaWS (dados publicos Receita Federal)
//   3. SindicoNet — diretório de síndicos/administradoras
//   4. Apollo.io (fallback, precisa de API key paga)

import { NextResponse } from 'next/server';
import { runAllScrapers, type ScrapedContact } from '@/lib/scrapers';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { DEFAULT_TENANT_ID } from '@/lib/env';
import { normalizePhone, phoneVariants } from '@/lib/utils';

const DAILY_TARGET = 10;

export async function POST() {
  const startTime = Date.now();
  const results = {
    searched: 0,
    newLeads: 0,
    duplicates: 0,
    withPhone: 0,
    withoutPhone: 0,
    errors: [] as string[],
    lokiQueued: 0,
    sources: { condominioemfoco: 0, cnpj: 0, sindiconet: 0, google: 0, apollo: 0 },
  };

  try {
    console.log('[HAWKEYE] Starting daily prospecting run...');
    await logAction('Iniciando prospeccao diaria — meta: 10 leads qualificados');

    // ═══ PHASE 1: Scrape contacts from free sources ═══
    let scrapedContacts: ScrapedContact[] = [];

    try {
      const scraperResult = await runAllScrapers({
        target: DAILY_TARGET + 5,
      });

      scrapedContacts = scraperResult.contacts;
      results.searched = scrapedContacts.length;
      results.sources.condominioemfoco = scraperResult.sources.condominioemfoco;
      results.sources.cnpj = scraperResult.sources.cnpj;
      results.sources.sindiconet = scraperResult.sources.sindiconet;
      results.sources.google = scraperResult.sources.google;

      if (scraperResult.errors.length > 0) {
        results.errors.push(...scraperResult.errors);
        console.warn('[HAWKEYE] Scraper warnings:', scraperResult.errors.join('; '));
      }

      console.log(`[HAWKEYE] Scrapers found ${scrapedContacts.length} contacts`);
      await logAction(
        `Scrapers encontraram ${scrapedContacts.length} contatos: ` +
        `Foco=${scraperResult.sources.condominioemfoco}, ` +
        `CNPJ=${scraperResult.sources.cnpj}, ` +
        `SindicoNet=${scraperResult.sources.sindiconet}, ` +
        `Google=${scraperResult.sources.google}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Scraper orchestrator failed: ${msg}`);
      console.error('[HAWKEYE] Scraper error:', msg);
    }

    // ═══ PHASE 2: Apollo fallback (if configured and scrapers found too few) ═══
    if (scrapedContacts.length < DAILY_TARGET && process.env.APOLLO_API_KEY) {
      try {
        const { searchSyndics } = await import('@/lib/apollo-client');
        const apolloLeads = await searchSyndics({
          perPage: DAILY_TARGET - scrapedContacts.length + 3,
        });

        // Pre-call dedup: Apollo custa crédito por lead, então descartamos
        // duplicatas ANTES de aceitar o contato (antes só descartávamos depois do insert).
        let apolloDuplicates = 0;
        for (const lead of apolloLeads) {
          if (!lead.phone) continue;
          const normalized = normalizePhone(lead.phone);
          if (!normalized) continue;

          const isDup = await checkDuplicate(normalized, lead.email);
          if (isDup) {
            apolloDuplicates++;
            continue;
          }

          scrapedContacts.push({
            name: lead.name,
            phone: normalized,
            fax: null,
            website: null,
            email: lead.email,
            neighborhood: null,
            source: 'apollo',
            city: lead.city,
            state: lead.state,
          });
          results.sources.apollo++;
        }

        console.log(
          `[HAWKEYE] Apollo added ${results.sources.apollo} contacts (${apolloDuplicates} duplicatas ignoradas)`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Apollo fallback failed: ${msg}`);
        console.error('[HAWKEYE] Apollo error:', msg);
      }
    }

    // ═══ PHASE 3: Save leads & queue LOKI ═══
    if (scrapedContacts.length === 0) {
      await logAction('Nenhum contato encontrado hoje. Verificar scrapers.');
      await saveSearchLog({
        source: 'hawkeye',
        query: `Prospeccao diaria — 0 contatos (scrapers falharam)`,
        results_count: 0,
        qualified_count: 0,
        leads_found: [],
        cost: 0,
        errors: results.errors,
      });
      return NextResponse.json({ ok: true, results, warning: 'No contacts found — scrapers may be down' });
    }

    let savedCount = 0;
    for (const contact of scrapedContacts) {
      if (savedCount >= DAILY_TARGET) break;

      if (!contact.phone) {
        results.withoutPhone++;
        continue;
      }

      // Check for duplicates (use normalized phone)
      const normalizedPhone = normalizePhone(contact.phone);
      const isDuplicate = await checkDuplicate(normalizedPhone, contact.email);
      if (isDuplicate) {
        results.duplicates++;
        continue;
      }

      // ═══ ATOMIC: Save lead + create conversation together ═══
      const leadId = crypto.randomUUID();

      const { data: savedLead, error: saveErr } = await supabase
        .from('leads')
        .insert({
          id: leadId,
          tenant_id: DEFAULT_TENANT_ID,
          name: contact.name,
          role: 'Administradora',
          phone: normalizedPhone,
          email: contact.email,
          source: contact.source,
          source_cost: 0,
          status: 'prospectado',
          qualified: true,
          notes: `${contact.neighborhood ? contact.neighborhood + ' | ' : ''}${contact.city}, ${contact.state}`,
          metadata: {
            scraped_source: contact.source,
            website: contact.website,
            fax: contact.fax,
            neighborhood: contact.neighborhood,
            city: contact.city,
            state: contact.state,
            hawkeye_date: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (saveErr) {
        results.errors.push(`Save failed for ${contact.name}: ${saveErr.message}`);
        console.error(`[HAWKEYE] Save error for ${contact.name}:`, saveErr.message);
        continue;
      }

      savedCount++;
      results.newLeads++;
      results.withPhone++;

      // Create conversation for LOKI (only if lead saved successfully)
      const { data: convo, error: convoErr } = await supabase
        .from('conversations')
        .insert({
          tenant_id: DEFAULT_TENANT_ID,
          lead_id: savedLead.id,
          agent_type: 'loki',
          channel: 'whatsapp',
          contact_name: contact.name,
          contact_phone: normalizedPhone,
          contact_role: 'Administradora',
          status: 'aguardando',
          unread: 0,
        })
        .select()
        .single();

      if (convoErr) {
        console.error(`[HAWKEYE] Conversation error for ${contact.name}:`, convoErr.message);
        results.errors.push(`Conversation failed for ${contact.name}: ${convoErr.message}`);
        // Don't increment lokiQueued since conversation failed
        continue;
      }

      results.lokiQueued++;

      // Schedule LOKI: 3 at 9:00, 3 at 10:00, 4 at 11:00
      const scheduleHour = savedCount <= 3 ? 9 : savedCount <= 6 ? 10 : 11;
      const scheduleMinute = Math.floor(Math.random() * 15);

      await logAction(
        `LOKI agendado: contatar ${contact.name} as ${scheduleHour}:${String(scheduleMinute).padStart(2, '0')}`,
        JSON.stringify({
          conversation_id: convo.id,
          lead_id: savedLead.id,
          phone: normalizedPhone,
          scheduled_hour: scheduleHour,
          scheduled_minute: scheduleMinute,
          type: 'first_contact',
        }),
        { source: 'hawkeye', action_type: 'loki_schedule' },
        'loki'
      );

      console.log(
        `[HAWKEYE] Saved lead ${savedCount}/${DAILY_TARGET}: ${contact.name} ` +
        `(${normalizedPhone}) [${contact.source}]`
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    await logAction(
      `Prospeccao concluida em ${elapsed}s: ` +
      `${results.newLeads} novos leads, ${results.withPhone} com telefone, ` +
      `${results.lokiQueued} agendados para LOKI. ` +
      `Fontes: Foco=${results.sources.condominioemfoco} CNPJ=${results.sources.cnpj} ` +
      `SindicoNet=${results.sources.sindiconet} Google=${results.sources.google} Apollo=${results.sources.apollo}`
    );

    // Save search_log so Buscas page shows the run
    await saveSearchLog({
      source: 'hawkeye',
      query: `Prospeccao diaria — meta ${DAILY_TARGET}`,
      results_count: results.searched,
      qualified_count: results.newLeads,
      leads_found: scrapedContacts.slice(0, 20).map(c => c.name),
      cost: 0,
      errors: results.errors,
    });

    console.log(`[HAWKEYE] Done. ${results.newLeads} new leads, ${results.lokiQueued} queued for LOKI`);

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HAWKEYE] Fatal error:', msg, err instanceof Error ? err.stack : '');
    await logAction(`ERRO FATAL: ${msg}`);
    return NextResponse.json({ ok: false, error: msg, results }, { status: 500 });
  }
}

// ═══ HELPERS ═══

async function checkDuplicate(phone: string | null, email: string | null): Promise<boolean> {
  if (!phone && !email) return false;

  const conditions: string[] = [];
  if (phone) {
    for (const variant of phoneVariants(phone)) {
      conditions.push(`phone.eq.${variant}`);
    }
  }
  if (email) conditions.push(`email.eq.${email}`);

  const { data } = await supabase
    .from('leads')
    .select('id')
    .or(conditions.join(','))
    .limit(1);

  return !!(data && data.length > 0);
}

async function saveSearchLog(params: {
  source: string;
  query: string;
  results_count: number;
  qualified_count: number;
  leads_found: string[];
  cost: number;
  errors: string[];
}) {
  try {
    const { error } = await supabase.from('search_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      source: params.source,
      query: params.query,
      results_count: params.results_count,
      qualified_count: params.qualified_count,
      leads_found: params.leads_found,
      cost: params.cost,
    });
    if (error) {
      console.error(`[HAWKEYE] search_logs insert error: ${error.message}`);
    }
  } catch (err) {
    console.error('[HAWKEYE] Failed to save search log:', err instanceof Error ? err.message : err);
  }
}

async function logAction(
  action: string,
  detail?: string,
  metadata?: Record<string, unknown>,
  agentType: string = 'hawkeye'
) {
  try {
    const { error } = await supabase.from('agent_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      agent_type: agentType,
      action,
      detail: detail || null,
      metadata: metadata || { source: 'hawkeye_daily_run' },
    });
    if (error) {
      // Table may not exist yet — log but don't crash
      console.warn(`[HAWKEYE] agent_logs: ${error.message}`);
    }
  } catch (err) {
    console.warn('[HAWKEYE] agent_logs unavailable:', err instanceof Error ? err.message : err);
  }
}

// Health check
export async function GET() {
  const apolloConfigured = !!process.env.APOLLO_API_KEY;
  const googleConfigured = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX);

  return NextResponse.json({
    agent: 'hawkeye',
    status: 'ready',
    daily_target: DAILY_TARGET,
    sources: {
      condominioemfoco: 'active (free)',
      cnpj_enrichment: 'active (free)',
      sindiconet: 'active (free scraping)',
      google_search: googleConfigured ? 'active (API key)' : 'active (HTML fallback)',
      apollo: apolloConfigured ? 'active (API key)' : 'inactive (no API key)',
    },
    timestamp: new Date().toISOString(),
  });
}
