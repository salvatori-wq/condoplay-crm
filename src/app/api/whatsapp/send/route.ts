import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/evolution-api';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { DEFAULT_TENANT_ID } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    const { phone, text, conversationId, agentType, contactName } = await req.json();

    if (!phone || !text) {
      return NextResponse.json({ error: 'phone and text required' }, { status: 400 });
    }

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, '').replace(/^0+/, '');

    // Send via Evolution API (encoding handled inside sendTextMessage)
    let result;
    try {
      result = await sendTextMessage(normalizedPhone, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Send] Evolution API error:', msg);
      return NextResponse.json({ error: 'send_failed', detail: msg }, { status: 502 });
    }

    // Find or create conversation
    let convId = conversationId;

    if (!convId) {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('channel', 'whatsapp')
        .eq('contact_phone', normalizedPhone)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        convId = existing[0].id;
      } else {
        // Check if phone matches a lead
        const phoneVariants = [normalizedPhone];
        if (normalizedPhone.startsWith('55')) {
          phoneVariants.push(normalizedPhone.substring(2));
        } else {
          phoneVariants.push(`55${normalizedPhone}`);
        }

        const { data: leads } = await supabase
          .from('leads')
          .select('id, name, role')
          .or(phoneVariants.map(p => `phone.eq.${p}`).join(','))
          .limit(1);

        const lead = leads?.[0] || null;

        const { data: newConvo, error: createErr } = await supabase
          .from('conversations')
          .insert({
            tenant_id: DEFAULT_TENANT_ID,
            lead_id: lead?.id || null,
            condo_id: null,
            agent_type: agentType || (lead ? 'loki' : 'hawkeye'),
            channel: 'whatsapp',
            contact_name: lead?.name || contactName || normalizedPhone,
            contact_phone: normalizedPhone,
            contact_role: lead?.role || 'Prospeccao WhatsApp',
            status: 'ativo',
            unread: 0,
          })
          .select()
          .single();

        if (createErr) {
          console.error('[Send] Error creating conversation:', createErr.message);
        } else {
          convId = newConvo.id;
        }
      }
    }

    // Save outgoing message to DB
    if (convId) {
      const { error: insertErr } = await supabase.from('messages').insert({
        conversation_id: convId,
        from_type: 'agent',
        content: text,
        metadata: {
          phone: normalizedPhone,
          agent_type: agentType || 'hawkeye',
          sent_via: 'crm_api',
        },
      });

      if (insertErr) {
        console.error('[Send] Error saving message:', insertErr.message);
      }

      const { error: updateErr } = await supabase
        .from('conversations')
        .update({ unread: 0, updated_at: new Date().toISOString() })
        .eq('id', convId);

      if (updateErr) {
        console.error('[Send] Error updating conversation:', updateErr.message);
      }
    } else {
      console.warn('[Send] Message sent but no conversation tracked for phone:', normalizedPhone);
    }

    return NextResponse.json({ ok: true, conversation_id: convId, result });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[Send] Error:', errorMsg);
    return NextResponse.json({ error: 'send_failed', message: errorMsg }, { status: 500 });
  }
}
