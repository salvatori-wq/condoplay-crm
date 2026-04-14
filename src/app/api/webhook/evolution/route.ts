import { NextRequest, NextResponse } from 'next/server';
import type { EvolutionWebhookPayload } from '@/lib/evolution-api';
import { extractMessageText, extractPhoneFromJid } from '@/lib/evolution-api';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { getAppUrl, DEFAULT_TENANT_ID } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    // Validate webhook token if configured
    const webhookToken = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (webhookToken) {
      const authHeader = req.headers.get('authorization') || req.headers.get('x-webhook-token');
      if (authHeader !== webhookToken && authHeader !== `Bearer ${webhookToken}`) {
        console.warn('[Webhook] Unauthorized request — invalid token');
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    const raw = await req.text();
    let payload: EvolutionWebhookPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      console.error('[Webhook] Invalid JSON received:', raw.substring(0, 200));
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    console.log(`[Webhook] Event: ${payload.event} | fromMe: ${payload.data?.key?.fromMe} | jid: ${payload.data?.key?.remoteJid}`);

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

    console.log(`[Webhook] ${isFromMe ? 'SENT' : 'RECEIVED'} ${phone}: ${text.substring(0, 50)}`);

    // Find or create conversation for this phone number
    let conversation;
    try {
      conversation = await findConversation(phone);
    } catch (findErr) {
      console.error('[Webhook] Error finding conversation:', findErr);
      throw findErr;
    }

    if (!conversation) {
      conversation = await createConversation(phone, contactName);
    }

    // Insert message
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
      console.error('[Webhook] Error inserting message:', msgError.message);
      return NextResponse.json({ error: 'insert_failed', detail: msgError.message }, { status: 500 });
    }

    // Update conversation
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      status: 'ativo',
    };

    if (!isFromMe) {
      updateData.unread = (conversation.unread || 0) + 1;
    }

    const { error: updateErr } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversation.id);

    if (updateErr) {
      console.error('[Webhook] Error updating conversation:', updateErr.message);
    }

    // Log + auto-respond (only for incoming)
    if (!isFromMe) {
      // Log to agent_logs
      const { error: logErr } = await supabase.from('agent_logs').insert({
        tenant_id: DEFAULT_TENANT_ID,
        agent_type: conversation.agent_type || 'jarvis',
        action: `WhatsApp de ${contactName}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
        detail: JSON.stringify({ phone, conversation_id: conversation.id }),
        metadata: { source: 'evolution_webhook' },
      });

      if (logErr) {
        console.error('[Webhook] Error logging:', logErr.message);
      }

      // ═══ AUTO-RESPOND VIA LOKI ═══
      if (conversation.lead_id && conversation.agent_type === 'loki') {
        const { data: agentCfg } = await supabase
          .from('AgentConfig')
          .select('pausado')
          .eq('tipoAgente', conversation.agent_type)
          .single();

        if (agentCfg?.pausado) {
          console.log(`[Webhook] Agent ${conversation.agent_type} is PAUSED. Skipping auto-respond.`);
        } else {
          console.log(`[Webhook] Triggering LOKI for conversation ${conversation.id}...`);
          try {
            const appUrl = getAppUrl();
            const lokiRes = await fetch(`${appUrl}/api/agents/loki/respond`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'respond',
                conversationId: conversation.id,
                incomingMessage: text,
              }),
            });

            if (!lokiRes.ok) {
              const errBody = await lokiRes.text().catch(() => '');
              console.error(`[Webhook] LOKI responded with ${lokiRes.status}: ${errBody.substring(0, 200)}`);
            } else {
              const lokiData = await lokiRes.json();
              console.log('[Webhook] LOKI responded:', lokiData.ok ? 'success' : 'failed');
            }
          } catch (err) {
            console.error('[Webhook] Failed to trigger LOKI:', err instanceof Error ? err.message : err);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, conversation_id: conversation.id, direction: isFromMe ? 'sent' : 'received' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[Webhook] Fatal error:', errorMsg);
    return NextResponse.json({ error: 'webhook_error', message: errorMsg }, { status: 500 });
  }
}

// ═══ HELPERS ═══

async function findConversation(phone: string) {
  const phoneVariants = [phone];
  if (phone.startsWith('55') && phone.length > 10) {
    phoneVariants.push(phone.substring(2));
  } else {
    phoneVariants.push(`55${phone}`);
  }

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
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, role')
    .or(`phone.eq.${phone},phone.eq.55${phone}`)
    .limit(1);

  const lead = leads?.[0] || null;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: DEFAULT_TENANT_ID,
      lead_id: lead?.id || null,
      condo_id: null,
      agent_type: lead ? 'loki' : 'jarvis',
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
