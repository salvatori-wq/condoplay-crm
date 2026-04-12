// ═══ SCHEDULER — Orchestrador de Agentes Autônomos ═══
// Chamado por cron job externo (Vercel Cron ou webhook).
// Decide qual agente rodar baseado no horário atual (BRT).
//
// Schedule (dias comerciais, seg-sáb):
//   08:00 — HAWKEYE: prospecção diária (10 leads)
//   09:00 — LOKI batch_contacts (3 primeiros contatos)
//   10:00 — LOKI batch_contacts (3 contatos)
//   11:00 — LOKI batch_contacts (4 contatos)
//   08-18h — LOKI batch_followups (FUPs em horário aleatório)

import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

export async function POST(req: Request) {
  const now = getBrazilTime();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=dom, 6=sáb

  const actions: string[] = [];
  const results: Record<string, unknown> = {};

  try {
    // ═══ 08:00 (seg-sáb) — HAWKEYE prospecção (1x/dia) ═══
    if (hour === 8 && dayOfWeek >= 1 && dayOfWeek <= 6) {
      console.log('[Scheduler] Triggering HAWKEYE...');
      const hawkeyeRes = await callAgent('hawkeye/run', 'POST');
      results.hawkeye = hawkeyeRes;
      actions.push('hawkeye');
    }

    // ═══ 09:00, 10:00, 11:00 (seg-sáb) — LOKI batch contacts ═══
    if ([9, 10, 11].includes(hour) && dayOfWeek >= 1 && dayOfWeek <= 6) {
      console.log(`[Scheduler] Triggering LOKI batch_contacts (${hour}h)...`);
      const lokiRes = await callAgent('loki/respond', 'POST', {
        action: 'batch_contacts',
        metadata: { scheduled_hour: hour },
      });
      results.loki_batch = lokiRes;
      actions.push(`loki_batch_${hour}h`);
    }

    // ═══ TODAS AS HORAS, TODOS OS DIAS — LOKI batch followups ═══
    // FUPs: máximo 3 dias (3 mensagens), depois marca como 'perdido'
    // Roda a cada hora com probabilidade para distribuir carga
    const shouldRunFup = await shouldRunFollowups();
    if (shouldRunFup) {
      console.log('[Scheduler] Triggering LOKI batch_followups...');
      const fupRes = await callAgent('loki/respond', 'POST', {
        action: 'batch_followups',
      });
      results.loki_fup = fupRes;
      actions.push('loki_followups');
    }

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
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ═══ MANUAL TRIGGER ═══
// GET /api/agents/scheduler?force=hawkeye
// GET /api/agents/scheduler?force=loki_batch
// GET /api/agents/scheduler?force=loki_fup

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
        '08:00': 'HAWKEYE prospecção',
        '09:00': 'LOKI 3 contatos',
        '10:00': 'LOKI 3 contatos',
        '11:00': 'LOKI 4 contatos',
        '08-18h': 'LOKI FUPs (aleatório)',
      },
    });
  }

  // Force-run specific agent
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
  try {
    const res = await fetch(`${APP_URL}/api/agents/${path}`, {
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
  // UTC-3 (horário de Brasília)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 3 * 3600000);
}

async function shouldRunFollowups(): Promise<boolean> {
  // Simple: run FUPs once per hour with 20% probability
  // This means ~2 FUP runs per business day (10h window * 20%)
  // In production, use a flag in the DB to ensure exactly 1 run/day
  return Math.random() < 0.2;
}
