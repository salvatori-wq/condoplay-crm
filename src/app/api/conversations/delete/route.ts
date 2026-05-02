import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';

export async function DELETE(req: NextRequest) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    // Delete messages first
    const { error: msgErr } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (msgErr) {
      console.error('[Delete] Error deleting messages:', msgErr);
    }

    // Delete conversation
    const { error: convErr } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (convErr) {
      console.error('[Delete] Error deleting conversation:', convErr);
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Delete] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
