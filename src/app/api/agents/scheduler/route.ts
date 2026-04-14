// ═══ SCHEDULER — Orchestrador de Agentes Autonomos ═══
// Cron diario (08:00 BRT / 11:00 UTC, seg-sab).
// Executa TUDO em sequencia:
//   1. HAWKEYE: prospeccao diaria (10 leads)
//   2. LOKI batch_contacts: contato inicial com leads novos
//   3. LOKI batch_followups: FUPs (max 3 dias, depois 'perdido')
//
// Respostas 24/7 sao feitas pelo webhook (nao depende do cron).

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getAppUrl, DEFAULT_TENANT_ID } from '@/lib/env';

async function isAgentPaused(agentType: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from('AgentConfig')
    .select('pausado')
    .eq('tipoAgente', agentType)
    .single();
  return data?.pausado === true;
}

export async function POST(req: Request) {
  const now = getBrazilTime();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  const actions: string[] = [];
  const results: Record<string, unknown> = {};
  const skipped: string[] = [];
  const errors: string[] = [];

  try {
    // ═══ STEP 1: HAWKEYE prospeccao (10 leads/dia) ═══
    if (await isAgentPaused('hawkeye')) {
      console.log('[Scheduler] HAWKEYE is PAUSED. Skipping.');
      skipped.push('hawkeye');
    } else {
      console.log('[Scheduler] Step 1: HAWKEYE prospecting...');
      const hawkeyeRes = await callAgent('hawkeye/run', 'POST');
      results.hawkeye = hawkeyeRes;
      actions.push('hawkeye');
      if (hawkeyeRes.error) errors.push(`hawkeye: ${hawkeyeRes.error}`);
    }

    // Espera 5s para leads serem inseridos no DB
    await sleep(5000);

    // ═══ STEP 2: LOKI batch_contacts (contato inicial) ═══
    if (await isAgentPaused('loki')) {
      console.log('[Scheduler] LOKI is PAUSED. Skipping batch contacts & followups.');
      skipped.push('loki_batch', 'loki_followups');
    } else {
      console.log('[Scheduler] Step 2: LOKI batch contacts...');
      const lokiRes = await callAgent('loki/respond', 'POST', {
        action: 'batch_contacts',
        metadata: { scheduled_hour: hour },
      });
      results.loki_batch = lokiRes;
      actions.push('loki_batch');
      if (lokiRes.error) errors.push(`loki_batch: ${lokiRes.error}`);

      // ═══ STEP 3: LOKI batch_followups (FUPs pendentes) ═══
      console.log('[Scheduler] Step 3: LOKI followups...');
      const fupRes = await callAgent('loki/respond', 'POST', {
        action: 'batch_followups',
      });
      results.loki_fup = fupRes;
      actions.push('loki_followups');
      if (fupRes.error) errors.push(`loki_fup: ${fupRes.error}`);
    }

    // Log run summary
    await logSchedulerRun(actions, skipped, errors);

    const ok = errors.length === 0;
    return NextResponse.json({
      ok,
      actions,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      results,
      time: now.toISOString(),
      hour,
      dayOfWeek,
    }, { status: ok ? 200 : 207 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Scheduler] Fatal error:', msg, err instanceof Error ? err.stack : '');
    return NextResponse.json({ ok: false, error: msg, actions, results }, { status: 500 });
  }
}

// ═══ MANUAL TRIGGER ═══
// GET /api/agents/scheduler?force=hawkeye
// GET /api/agents/scheduler?force=loki_batch
// GET /api/agents/scheduler?force=loki_fup
// GET /api/agents/scheduler?force=all

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get('force');

  if (!force) {
    const now = getBrazilTime();
    return NextResponse.json({
      agent: 'scheduler',
      status: 'ready',
      brazil_time: now.toISOString(),
      hour: now.getHours(),
      day: now.getDay(),
      is_business_day: now.getDay() !== 0,
      schedule: {
        cron: '08:00 BRT (seg-sab)',
        step_1: 'HAWKEYE prospeccao (10 leads)',
        step_2: 'LOKI batch_contacts (contato inicial)',
        step_3: 'LOKI batch_followups (FUPs max 3 dias)',
        webhook: 'Respostas 24/7 (auto via Evolution API)',
      },
    });
  }

  if (force === 'all') {
    const fakeReq = new Request(url.toString(), { method: 'POST' });
    return POST(fakeReq);
  }

  let result;
  switch (force) {
    case 'hawkeye':
      result = await callAgent('hawkeye/run', 'POST');
      break;
    case 'loki_batch':
      result = await callAgent('loki/respond', 'POST', { action: 'batch_contacts' });
      break;
    case 'loki_fup':
      result = await callAgent('loki/respond', 'POST', { action: 'batch_followups' });
      break;
    default:
      return NextResponse.json({ error: `Unknown agent: ${force}` }, { status: 400 });
  }

  return NextResponse.json({ ok: !result.error, forced: force, result });
}

// ═══ HELPERS ═══

async function callAgent(path: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const baseUrl = getAppUrl();

  try {
    const res = await fetch(`${baseUrl}/api/agents/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data?.error || `HTTP ${res.status}`;
      console.error(`[Scheduler] callAgent(${path}) failed: ${errorMsg}`);
      return { error: errorMsg, status: res.status, ...data };
    }

    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Scheduler] callAgent(${path}) network error: ${msg}`);
    return { error: `Network error: ${msg}` };
  }
}

async function logSchedulerRun(actions: string[], skipped: string[], errors: string[]) {
  try {
    await supabaseServer.from('agent_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      agent_type: 'tibia',
      action: errors.length > 0
        ? `Scheduler com erros: ${errors.join(', ')}`
        : `Scheduler OK: ${actions.join(', ')}`,
      detail: JSON.stringify({ actions, skipped, errors }),
      metadata: { source: 'scheduler_cron' },
    });
  } catch (err) {
    console.error('[Scheduler] Failed to log run:', err instanceof Error ? err.message : err);
  }
}

function getBrazilTime(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 3 * 3600000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
