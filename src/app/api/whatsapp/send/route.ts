import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/evolution-api';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const DEFAULT_TENANT_ID = 'aaaa0001-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
  try {
    const { phone, text, conversationId, agentType, contactName } = await req.json();

    if (!phone || !text) {
      return NextResponse.json({ error: 'phone and text required' }, { status: 400 });
    }

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, '').replace(/^0+/, '');

    // Send via Evolution API
    const result = await sendTextMessage(normalizedPhone, text);

    // Find or create conversation
    let convId = conversationId;

    if (!convId) {
      // Try to find existing conversation for this phone
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

        // Create new conversation
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
          console.error('[Send] Error creating conversation:', createErr);
        } else {
          convId = newConvo.id;
          console.log('[Send] Created new conversation:', convId, 'for', normalizedPhone);
        }
      }
    }

    // Save outgoing message to DB
    if (convId) {
      await supabase.from('messages').insert({
        conversation_id: convId,
        from_type: 'agent',
        content: text,
        metadata: {
          phone: normalizedPhone,
          evolution_response: result,
          agent_type: agentType || 'hawkeye',
          sent_via: 'crm_api',
        },
      });

      // Update timestamp
      await supabase
        .from('conversations')
        .update({ unread: 0, updated_at: new Date().toISOString() })
        .eq('id', convId);
    }

    return NextResponse.json({ ok: true, conversation_id: convId, result });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[Send] Error:', errorMsg);
    return NextResponse.json({ error: 'send_failed', message: errorMsg }, { status: 500 });
  }
}
