import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AGENT_PROMPTS } from '@/lib/agent-prompts';
import type { AgentType } from '@/types/database';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const VALID_AGENTS = Object.keys(AGENT_PROMPTS) as AgentType[];

// GET: return current prompts (DB override or fallback to constant)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('AgentConfig')
      .select('tipoAgente, metadata');

    const prompts: Record<string, string> = { ...AGENT_PROMPTS };

    if (!error && data) {
      for (const row of data) {
        const agentType = row.tipoAgente as AgentType;
        const meta = row.metadata as Record<string, unknown> | null;
        if (meta && typeof meta.system_prompt === 'string') {
          prompts[agentType] = meta.system_prompt;
        }
      }
    }

    return NextResponse.json({ ok: true, prompts });
  } catch (err) {
    console.error('[AgentPrompts GET]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// PUT: save updated prompt for an agent type
export async function PUT(req: NextRequest) {
  try {
    const { agentType, prompt } = await req.json();

    if (!agentType || !VALID_AGENTS.includes(agentType)) {
      return NextResponse.json({ error: 'Invalid agentType' }, { status: 400 });
    }

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // First try to get existing row
    const { data: existing } = await supabase
      .from('AgentConfig')
      .select('agenteId, metadata')
      .eq('tipoAgente', agentType)
      .maybeSingle();

    const existingMeta = (existing?.metadata as Record<string, unknown>) || {};
    const updatedMeta = { ...existingMeta, system_prompt: prompt.trim() };

    const { data, error } = await supabase
      .from('AgentConfig')
      .upsert({
        agenteId: agentType,
        tipoAgente: agentType,
        metadata: updatedMeta,
        atualizadoEm: now,
      }, { onConflict: 'agenteId,tipoAgente' })
      .select()
      .single();

    if (error) {
      console.error('[AgentPrompts PUT] Supabase error:', error);
      return NextResponse.json({ error: 'save_failed', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, config: data });
  } catch (err) {
    console.error('[AgentPrompts PUT]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
