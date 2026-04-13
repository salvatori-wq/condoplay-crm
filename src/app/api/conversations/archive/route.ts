import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { conversationIds, archived } = await req.json();

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json({ error: 'conversationIds required (array)' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('WhatsAppConversa')
      .update({ arquivada: archived !== false, atualizadoEm: new Date().toISOString() })
      .in('id', conversationIds)
      .select('id, arquivada');

    if (error) {
      console.error('[Archive] Error:', error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: data?.length || 0, conversations: data });
  } catch (err) {
    console.error('[Archive] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
