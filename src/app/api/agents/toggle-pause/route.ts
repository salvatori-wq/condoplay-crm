import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { agentType, paused } = await req.json();

    if (!agentType) {
      return NextResponse.json({ error: 'agentType required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('AgentConfig')
      .upsert({
        agenteId: agentType,
        tipoAgente: agentType,
        pausado: paused !== false,
        pausadoEm: paused !== false ? now : null,
        pausadoPor: 'crm_manual',
        atualizadoEm: now,
      }, { onConflict: 'agenteId,tipoAgente' })
      .select()
      .single();

    if (error) {
      console.error('[TogglePause] Error:', error);
      return NextResponse.json({ error: 'upsert_failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, config: data });
  } catch (err) {
    console.error('[TogglePause] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// GET: return pause status for all agents
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('AgentConfig')
      .select('tipoAgente, pausado, pausadoEm');

    if (error) {
      // Table might not exist yet — return empty
      return NextResponse.json({ ok: true, agents: {}, details: [] });
    }

    // Return as map for easy lookup
    const pauseMap: Record<string, boolean> = {};
    for (const row of data || []) {
      pauseMap[row.tipoAgente] = row.pausado;
    }

    return NextResponse.json({ ok: true, agents: pauseMap, details: data });
  } catch (err) {
    console.error('[TogglePause GET] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
