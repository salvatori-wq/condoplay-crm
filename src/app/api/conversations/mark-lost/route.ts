import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { conversationId, lossReason, lossNotes } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }
    if (!lossReason) {
      return NextResponse.json({ error: 'lossReason required' }, { status: 400 });
    }

    // Update conversation status to PERDIDA
    const { data, error } = await supabase
      .from('WhatsAppConversa')
      .update({
        status: 'PERDIDA',
        motivoPerda: lossReason,
        notasPerda: lossNotes || null,
        atualizadoEm: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select('id, tipo, nomeContato, motivoPerda')
      .single();

    if (error) {
      console.error('[MarkLost] Error:', error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    // Also update linked lead status if exists
    const { data: convo } = await supabase
      .from('WhatsAppConversa')
      .select('leadId')
      .eq('id', conversationId)
      .single();

    if (convo?.leadId) {
      await supabase
        .from('LeadProspectado')
        .update({ status: 'PERDIDO', atualizadoEm: new Date().toISOString() })
        .eq('id', convo.leadId);
    }

    // Log for training analysis
    try {
      await supabase.from('LeadFeedback').insert({
        leadId: convo?.leadId || null,
        conversaId: conversationId,
        tipo: 'PERDA',
        motivo: lossReason,
        notas: lossNotes || null,
        agente: data.tipo,
        criadoEm: new Date().toISOString(),
      });
    } catch {
      console.log('[MarkLost] LeadFeedback insert skipped');
    }

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
      .from('WhatsAppConversa')
      .select('tipo, motivoPerda, notasPerda, nomeContato, atualizadoEm')
      .eq('status', 'PERDIDA')
      .not('motivoPerda', 'is', null)
      .order('atualizadoEm', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    // Aggregate by reason
    const byReason: Record<string, number> = {};
    const byAgent: Record<string, Record<string, number>> = {};
    for (const row of data || []) {
      const reason = row.motivoPerda || 'unknown';
      byReason[reason] = (byReason[reason] || 0) + 1;
      if (!byAgent[row.tipo]) byAgent[row.tipo] = {};
      byAgent[row.tipo][reason] = (byAgent[row.tipo][reason] || 0) + 1;
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
