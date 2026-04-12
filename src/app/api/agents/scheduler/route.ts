// ═══ SCHEDULER — Orchestrador de Agentes Autônomos ═══
// Cron diário (08:00 BRT / 11:00 UTC, seg-sáb).
// Executa TUDO em sequência:
//   1. HAWKEYE: prospecção diária (10 leads)
//   2. LOKI batch_contacts: contato inicial com leads novos
//   3. LOKI batch_followups: FUPs (max 3 dias, depois 'perdido')
//
// Respostas 24/7 são feitas pelo webhook (não depende do cron).

import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3002';

export async function POST(req: Request) {
  const now = getBrazilTime();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  const actions: string[] = [];
  const results: Record<string, unknown> = {};

  try {
    // ═══ STEP 1: HAWKEYE prospecção (10 leads/dia) ═══
    console.log('[Scheduler] Step 1: HAWKEYE prospecting...');
    const hawkeyeRes = await callAgent('hawkeye/run', 'POST');
    results.hawkeye = hawkeyeRes;
    actions.push('hawkeye');

    // Espera 5s para leads serem inseridos no DB
    await sleep(5000);

    // ═══ STEP 2: LOKI batch_contacts (contato inicial) ═══
    console.log('[Scheduler] Step 2: LOKI batch contacts...');
    const lokiRes = await callAgent('loki/respond', 'POST', {
      action: 'batch_contacts',
      metadata: { scheduled_hour: hour },
    });
    results.loki_batch = lokiRes;
    actions.push('loki_batch');

    // ═══ STEP 3: LOKI batch_followups (FUPs pendentes) ═══
    console.log('[Scheduler] Step 3: LOKI followups...');
    const fupRes = await callAgent('loki/respond', 'POST', {
      action: 'batch_followups',
    });
    results.loki_fup = fupRes;
    actions.push('loki_followups');

    return NextResponse.json({
      ok: true,
      actions,
      results,
      time: now.toISOString(),
      hour,
      dayOfWeek,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Scheduler] Error:', msg);
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
        cron: '08:00 BRT (seg-sáb)',
        step_1: 'HAWKEYE prospecção (10 leads)',
        step_2: 'LOKI batch_contacts (contato inicial)',
        step_3: 'LOKI batch_followups (FUPs max 3 dias)',
        webhook: 'Respostas 24/7 (auto via Evolution API)',
      },
    });
  }

  // Force-run specific agent or all
  if (force === 'all') {
    // Simulate full daily run
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

  return NextResponse.json({ ok: true, forced: force, result });
}

// ═══ HELPERS ═══

async function callAgent(path: string, method: string, body?: unknown): Promise<unknown> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002');

  try {
    const res = await fetch(`${baseUrl}/api/agents/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    return await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
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
