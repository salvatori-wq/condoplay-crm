import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const DEFAULT_TENANT_ID = 'aaaa0001-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
  try {
    const { conversationId, lossReason, lossNotes } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }
    if (!lossReason) {
      return NextResponse.json({ error: 'lossReason required' }, { status: 400 });
    }

    // Update conversation status to perdido
    const { data, error } = await supabase
      .from('conversations')
      .update({
        status: 'perdido',
        loss_reason: lossReason,
        loss_notes: lossNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select('id, agent_type, contact_name, loss_reason')
      .single();

    if (error) {
      console.error('[MarkLost] Error:', error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    // Also update linked lead status if exists
    const { data: convo } = await supabase
      .from('conversations')
      .select('lead_id')
      .eq('id', conversationId)
      .single();

    if (convo?.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'perdido', updated_at: new Date().toISOString() })
        .eq('id', convo.lead_id);
    }

    // Log for training analysis
    await supabase.from('agent_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      agent_type: data.agent_type,
      action: `Conversa perdida: ${data.contact_name} — ${lossReason}`,
      detail: lossNotes || null,
      metadata: { conversation_id: conversationId, loss_reason: lossReason, source: 'mark_lost' },
    });

    return NextResponse.json({ ok: true, conversation: data });
  } catch (err) {
    console.error('[MarkLost] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// GET: loss reasons analytics for agent training
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('agent_type, loss_reason, loss_notes, contact_name, updated_at')
      .eq('status', 'perdido')
      .not('loss_reason', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    // Aggregate by reason
    const byReason: Record<string, number> = {};
    const byAgent: Record<string, Record<string, number>> = {};
    for (const row of data || []) {
      const reason = row.loss_reason || 'unknown';
      byReason[reason] = (byReason[reason] || 0) + 1;
      if (!byAgent[row.agent_type]) byAgent[row.agent_type] = {};
      byAgent[row.agent_type][reason] = (byAgent[row.agent_type][reason] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      total: data?.length || 0,
      byReason,
      byAgent,
      recent: data?.slice(0, 20),
    });
  } catch (err) {
    console.error('[MarkLost GET] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
