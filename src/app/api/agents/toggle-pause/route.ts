import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const DEFAULT_TENANT_ID = 'aaaa0001-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
  try {
    const { agentType, paused } = await req.json();

    if (!agentType) {
      return NextResponse.json({ error: 'agentType required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('agent_config')
      .upsert({
        tenant_id: DEFAULT_TENANT_ID,
        agent_type: agentType,
        paused: paused !== false,
        paused_at: paused !== false ? now : null,
        paused_by: 'crm_manual',
        updated_at: now,
      }, { onConflict: 'tenant_id,agent_type' })
      .select()
      .single();

    if (error) {
      console.error('[TogglePause] Error:', error);
      return NextResponse.json({ error: 'upsert_failed' }, { status: 500 });
    }

    // Log the action
    await supabase.from('agent_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      agent_type: agentType,
      action: paused !== false ? `Agente ${agentType} PAUSADO` : `Agente ${agentType} RETOMADO`,
      detail: null,
      metadata: { source: 'toggle_pause' },
    });

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
      .from('agent_config')
      .select('agent_type, paused, paused_at')
      .eq('tenant_id', DEFAULT_TENANT_ID);

    if (error) {
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    // Return as map for easy lookup
    const pauseMap: Record<string, boolean> = {};
    for (const row of data || []) {
      pauseMap[row.agent_type] = row.paused;
    }

    return NextResponse.json({ ok: true, agents: pauseMap, details: data });
  } catch (err) {
    console.error('[TogglePause GET] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
