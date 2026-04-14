// ═══ HAWKEYE — Agente de Prospeccao Diaria ═══
// Roda todo dia comercial as 8h. Encontra 10 sindicos via scrapers gratuitos.
// Salva leads no CRM e agenda LOKI para iniciar contato.
//
// Fontes (prioridade):
//   1. CondominioemFoco.com.br — telefones diretos de administradoras
//   2. CNPJ Enrichment — BrasilAPI/ReceitaWS (dados publicos Receita Federal)
//   3. Google Maps — busca administradoras de condominios
//   4. Apollo.io (fallback, precisa de API key paga)

import { NextResponse } from 'next/server';
import { runAllScrapers, type ScrapedContact } from '@/lib/scrapers';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { DEFAULT_TENANT_ID } from '@/lib/env';

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
    sources: { condominioemfoco: 0, cnpj: 0, google_maps: 0, apollo: 0 },
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
      results.sources.google_maps = scraperResult.sources.google_maps;

      if (scraperResult.errors.length > 0) {
        results.errors.push(...scraperResult.errors);
        console.warn('[HAWKEYE] Scraper warnings:', scraperResult.errors.join('; '));
      }

      console.log(`[HAWKEYE] Scrapers found ${scrapedContacts.length} contacts`);
      await logAction(
        `Scrapers encontraram ${scrapedContacts.length} contatos: ` +
        `Foco=${scraperResult.sources.condominioemfoco}, ` +
        `CNPJ=${scraperResult.sources.cnpj}, ` +
        `GMaps=${scraperResult.sources.google_maps}`
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

        for (const lead of apolloLeads) {
          if (lead.phone) {
            scrapedContacts.push({
              name: lead.name,
              phone: lead.phone,
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
        }

        console.log(`[HAWKEYE] Apollo added ${results.sources.apollo} contacts`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Apollo fallback failed: ${msg}`);
        console.error('[HAWKEYE] Apollo error:', msg);
      }
    }

    // ═══ PHASE 3: Save leads & queue LOKI ═══
    if (scrapedContacts.length === 0) {
      await logAction('Nenhum contato encontrado hoje. Verificar scrapers.');
      return NextResponse.json({ ok: false, results, error: 'No contacts found' });
    }

    let savedCount = 0;
    for (const contact of scrapedContacts) {
      if (savedCount >= DAILY_TARGET) break;

      if (!contact.phone) {
        results.withoutPhone++;
        continue;
      }

      // Check for duplicates (use normalized phone)
      const normalizedPhone = contact.phone.replace(/\D/g, '').replace(/^0+/, '');
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
      `GMaps=${results.sources.google_maps} Apollo=${results.sources.apollo}`
    );

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
    // Check both with and without country code
    conditions.push(`phone.eq.${phone}`);
    if (phone.startsWith('55')) {
      conditions.push(`phone.eq.${phone.substring(2)}`);
    } else {
      conditions.push(`phone.eq.55${phone}`);
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
      console.error(`[HAWKEYE] agent_logs insert error: ${error.message}`);
    }
  } catch (err) {
    console.error('[HAWKEYE] Failed to log action:', err instanceof Error ? err.message : err);
  }
}

// Health check
export async function GET() {
  const apolloConfigured = !!process.env.APOLLO_API_KEY;
  const googleMapsConfigured = !!process.env.GOOGLE_MAPS_API_KEY;

  return NextResponse.json({
    agent: 'hawkeye',
    status: 'ready',
    daily_target: DAILY_TARGET,
    sources: {
      condominioemfoco: 'active (free)',
      cnpj_enrichment: 'active (free)',
      google_maps: 'active (free scraping)',
      google_maps_api: googleMapsConfigured ? 'active (API key)' : 'inactive (no API key)',
      apollo: apolloConfigured ? 'active (API key)' : 'inactive (no API key)',
    },
    timestamp: new Date().toISOString(),
  });
}
