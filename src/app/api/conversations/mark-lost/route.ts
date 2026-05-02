import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { conversationId, lossReason, lossNotes } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }
    if (!lossReason) {
      return NextResponse.json({ error: 'lossReason required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('conversations')
      .update({
        status: 'perdido',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select('id, agent_type, contact_name, lead_id')
      .single();

    if (error) {
      console.error('[MarkLost] Error:', error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    // Update linked lead status if exists
    if (data?.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'perdido' })
        .eq('id', data.lead_id);
    }

    return NextResponse.json({ ok: true, conversation: data });
  } catch (err) {
    console.error('[MarkLost] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
