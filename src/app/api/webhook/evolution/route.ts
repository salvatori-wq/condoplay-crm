import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { EvolutionWebhookPayload } from '@/lib/evolution-api';
import { extractMessageText, extractPhoneFromJid } from '@/lib/evolution-api';

// Use service-level supabase client for webhook (server-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const DEFAULT_TENANT_ID = 'aaaa0001-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    let payload: EvolutionWebhookPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      console.error('[Webhook] Invalid JSON received:', raw.substring(0, 200));
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    // Log EVERY webhook event for debugging
    console.log(`[Webhook] Event: ${payload.event} | fromMe: ${payload.data?.key?.fromMe} | jid: ${payload.data?.key?.remoteJid} | text: ${payload.data?.message?.conversation?.substring(0, 40) || payload.data?.message?.extendedTextMessage?.text?.substring(0, 40) || '[no text]'}`);

    // Only process messages
    if (payload.event !== 'MESSAGES_UPSERT') {
      return NextResponse.json({ ok: true, skipped: payload.event });
    }

    // Skip group messages
    if (payload.data.key.remoteJid?.endsWith('@g.us')) {
      return NextResponse.json({ ok: true, skipped: 'group' });
    }

    const isFromMe = payload.data.key.fromMe;
    const phone = extractPhoneFromJid(payload.data.key.remoteJid);
    const text = extractMessageText(payload);
    const contactName = payload.data.pushName || phone;

    if (!text) {
      return NextResponse.json({ ok: true, skipped: 'empty' });
    }

    console.log(`[Webhook] ${isFromMe ? '→ SENT' : '← RECEIVED'} ${phone} - ${contactName}: ${text.substring(0, 50)}`);

    // Find or create conversation for this phone number
    let conversation;
    try {
      conversation = await findConversation(phone);
    } catch (findErr) {
      console.error('[Webhook] Error finding conversation:', findErr);
      throw findErr;
    }

    if (!conversation) {
      try {
        conversation = await createConversation(phone, contactName);
      } catch (createErr) {
        console.error('[Webhook] Error creating conversation:', createErr);
        throw createErr;
      }
    }

    console.log('[Webhook] Conversation:', conversation.id);

    // Insert message — from_type depends on direction
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      from_type: isFromMe ? 'agent' : 'contact',
      content: text,
      metadata: {
        phone,
        whatsapp_msg_id: payload.data.key.id,
        push_name: contactName,
        message_type: payload.data.messageType || 'text',
        from_me: isFromMe,
      },
    });

    if (msgError) {
      console.error('Error inserting message:', msgError);
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
    }

    // Update conversation
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      status: 'ativo',
    };

    // Only bump unread for incoming messages
    if (!isFromMe) {
      updateData.unread = (conversation.unread || 0) + 1;
    }

    await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversation.id);

    // Log in agent_logs (only for incoming — avoid noise from outgoing)
    if (!isFromMe) {
      await supabase.from('agent_logs').insert({
        tenant_id: DEFAULT_TENANT_ID,
        agent_type: conversation.agent_type || 'jarvis',
        action: `WhatsApp de ${contactName}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
        detail: JSON.stringify({ phone, conversation_id: conversation.id }),
        metadata: { source: 'evolution_webhook' },
      });

      // ═══ AUTO-RESPOND VIA LOKI — só se for lead do HAWKEYE ═══
      if (conversation.lead_id && conversation.agent_type === 'loki') {
        console.log(`[Webhook] Lead do HAWKEYE respondeu. Acionando LOKI para conversa ${conversation.id}...`);
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
          // Fire-and-forget — não bloqueia o webhook
          fetch(`${appUrl}/api/agents/loki/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'respond',
              conversationId: conversation.id,
              incomingMessage: text,
            }),
          }).catch(err => console.error('[Webhook] LOKI auto-respond failed:', err));
        } catch (err) {
          console.error('[Webhook] Failed to trigger LOKI:', err);
        }
      }
    }

    return NextResponse.json({ ok: true, conversation_id: conversation.id, direction: isFromMe ? 'sent' : 'received' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('Webhook error:', errorMsg);
    return NextResponse.json({ error: 'webhook_error', message: errorMsg }, { status: 500 });
  }
}

// ═══ HELPERS ═══

async function findConversation(phone: string) {
  // Normalize: try with and without country code
  const phoneVariants = [phone];
  if (phone.startsWith('55') && phone.length > 10) {
    phoneVariants.push(phone.substring(2)); // without country code
  } else {
    phoneVariants.push(`55${phone}`); // with country code
  }

  // Search conversations by phone stored in metadata
  for (const p of phoneVariants) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('channel', 'whatsapp')
      .or(`contact_phone.eq.${p},contact_name.ilike.%${p}%`)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) return data[0];
  }

  // Also check leads table for phone match
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name')
    .or(phoneVariants.map(p => `phone.eq.${p}`).join(','))
    .limit(1);

  if (leads && leads.length > 0) {
    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', leads[0].id)
      .eq('channel', 'whatsapp')
      .limit(1);

    if (convos && convos.length > 0) return convos[0];
  }

  return null;
}

async function createConversation(phone: string, contactName: string) {
  // Check if this phone belongs to an existing lead
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, role')
    .or(`phone.eq.${phone},phone.eq.+55${phone},phone.eq.55${phone}`)
    .limit(1);

  const lead = leads?.[0] || null;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: DEFAULT_TENANT_ID,
      lead_id: lead?.id || null,
      condo_id: null,
      agent_type: lead ? 'loki' : 'jarvis', // Sales if lead, support otherwise
      channel: 'whatsapp',
      contact_name: lead?.name || contactName,
      contact_phone: phone,
      contact_role: lead?.role || 'Novo contato WhatsApp',
      status: 'ativo',
      unread: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'evolution-api',
    timestamp: new Date().toISOString(),
  });
}
