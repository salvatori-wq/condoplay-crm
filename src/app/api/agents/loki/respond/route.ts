// ═══ LOKI — Agente de Vendas da Condo Play ═══
// Se passa por Joao Salvatori. Objetivo: marcar reuniao.
// Reunioes: 12-13h ou 18h+, segunda a sabado.
// Contato inicial: 3 as 9h, 3 as 10h, 4 as 11h.
// FUP: 1 msg/dia por 3 dias, horarios aleatorios (8-18h).
// Multi-LLM com failover: Groq(Llama) → Gemini → Claude.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callLLM, getAvailableProviders } from '@/lib/multi-llm';
import { sendTextMessage } from '@/lib/evolution-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const DEFAULT_TENANT_ID = 'aaaa0001-0000-0000-0000-000000000001';

// ═══ SYSTEM PROMPT DO LOKI ═══
const LOKI_SYSTEM_PROMPT = `Voce e Joao Salvatori, Diretor Comercial da Condo Play.
A Condo Play leva jogos de tabuleiro modernos para condominios, criando convivencia entre moradores.

PERSONALIDADE:
- Simpatico, acessivel, entusiasmado com jogos e comunidade
- Comunicacao direta mas calorosa
- Usa emojis com moderacao (1-2 por mensagem)
- Tom consultivo — entende a dor antes de vender
- NUNCA parece robotico. Fale como um empresario jovem e apaixonado pelo negocio.

CONHECIMENTO DE CONDOMINIO:
- Sindicos profissionais gerenciam multiplos condominios
- Areas de lazer subutilizadas sao uma dor comum
- Moradores reclamam de falta de opcoes de entretenimento
- Taxa condominial alta sem retorno em qualidade de vida
- Jogos de tabuleiro modernos (Catan, Dixit, Azul) nao sao os classicos de antigamente
- Acervo rotativo a cada 4 meses para manter novidade

PLANOS:
- Ate 80 unidades: R$1.500/mes
- 80-200 unidades: R$2.200/mes
- 200+ unidades: R$3.000/mes
- Inclui: acervo de 8-15 jogos, suporte, troca quadrimestral, treinamento portaria

OBJETIVO CENTRAL: Marcar uma reuniao (videoconferencia ou presencial).
- Reunioes APENAS: 12h-13h ou 18h+, segunda a sabado
- Ao marcar: confirmar dia, horario, e se prefere video ou presencial
- Enviar link do Google Meet se for video
- SOLICITAR EMAIL do sindico para confirmar na agenda

REGRAS:
- Primeira mensagem: apresentacao + gancho (area de lazer, convivencia)
- Se o sindico responder: investigar a dor, depois propor reuniao
- NAO enviar proposta por WhatsApp. Proposta so em reuniao.
- Se pedir preco: dar faixa de valores mas direcionar para reuniao
- Se nao responder: FUP educado em 24h, depois 48h, depois encerrar
- Quando reuniao agendada: mover card para "reuniao_agendada"

CONTATO: salvatori@washme.com.br (enviar confirmacao por email)

FORMATO: Responda APENAS com a mensagem que sera enviada ao sindico. Sem explicacoes extras.`;

// ═══ ENDPOINTS ═══

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'first_contact':
        return await handleFirstContact(body);
      case 'respond':
        return await handleResponse(body);
      case 'followup':
        return await handleFollowUp(body);
      case 'batch_contacts':
        return await handleBatchContacts();
      case 'batch_followups':
        return await handleBatchFollowups();
      case 'schedule_meeting':
        return await handleScheduleMeeting(body);
      default:
        return NextResponse.json({ error: 'Invalid action. Use: first_contact, respond, followup, batch_contacts, batch_followups, schedule_meeting' }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[LOKI] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ═══ GUARD: Só opera em conversas do HAWKEYE ═══

async function assertHawkeyeConversation(conversationId: string) {
  const { data: convo } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .not('lead_id', 'is', null)
    .single();

  if (!convo) return null; // Conversa não existe OU não tem lead vinculado (não é do HAWKEYE)
  return convo;
}

// ═══ FIRST CONTACT — Mensagem inicial para novo lead ═══

async function handleFirstContact(body: { conversationId: string; leadId?: string }) {
  const { conversationId, leadId } = body;

  // GUARD: Só conversa com leads do HAWKEYE
  const convo = await assertHawkeyeConversation(conversationId);
  if (!convo) {
    console.log(`[LOKI] Ignorando conversa ${conversationId} — sem lead vinculado (não é do HAWKEYE)`);
    return NextResponse.json({ error: 'Conversation not linked to a HAWKEYE lead. LOKI only contacts leads from HAWKEYE.' }, { status: 403 });
  }

  let leadInfo = '';
  const actualLeadId = leadId || convo.lead_id;
  if (actualLeadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', actualLeadId)
      .single();

    if (lead) {
      leadInfo = `\nINFO DO LEAD:
- Nome: ${lead.name}
- Cargo: ${lead.role || 'Sindico'}
- Empresa/Condo: ${lead.notes || ''}
- Fonte: ${lead.source || 'prospeccao'}`;
    }
  }

  // Generate first contact message
  const response = await callLLM([
    { role: 'system', content: LOKI_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Gere a PRIMEIRA mensagem de abordagem para este sindico. Seja natural, como se estivesse mandando um WhatsApp pessoal.${leadInfo}

A mensagem deve:
1. Se apresentar como Joao Salvatori da Condo Play
2. Mencionar algo relevante sobre o condominio/cargo se tiver info
3. Gancho sobre area de lazer ou convivencia
4. Ser curta (max 3 paragrafos)
5. Terminar com pergunta aberta que convide resposta`,
    },
  ]);

  // Send via WhatsApp
  const phone = convo.contact_phone;
  if (!phone) {
    return NextResponse.json({ error: 'No phone number for this conversation' }, { status: 400 });
  }

  const sendResult = await sendTextMessage(phone, response.text);

  // Save message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    from_type: 'agent',
    content: response.text,
    metadata: {
      phone,
      agent_type: 'loki',
      llm_provider: response.provider,
      llm_model: response.model,
      contact_type: 'first_contact',
      sent_via: 'loki_agent',
    },
  });

  // Update conversation status
  await supabase
    .from('conversations')
    .update({
      status: 'ativo',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  // Update lead status
  if (convo.lead_id) {
    await supabase
      .from('leads')
      .update({ status: 'em_contato', updated_at: new Date().toISOString() })
      .eq('id', convo.lead_id);
  }

  // Log
  await logAction(
    `Primeiro contato enviado para ${convo.contact_name} (${phone}) via ${response.provider}`,
    { conversation_id: conversationId, provider: response.provider }
  );

  return NextResponse.json({
    ok: true,
    message_sent: response.text,
    provider: response.provider,
    model: response.model,
    evolution_result: sendResult,
  });
}

// ═══ RESPOND — Responder mensagem do sindico ═══

async function handleResponse(body: { conversationId: string; incomingMessage: string }) {
  const { conversationId, incomingMessage } = body;

  // GUARD: Só responde leads do HAWKEYE
  const convo = await assertHawkeyeConversation(conversationId);
  if (!convo) {
    console.log(`[LOKI] Ignorando resposta em conversa ${conversationId} — não é lead do HAWKEYE`);
    return NextResponse.json({ error: 'Not a HAWKEYE lead. LOKI ignoring.' }, { status: 403 });
  }

  // Get conversation history (last 20 messages)
  const { data: messages } = await supabase
    .from('messages')
    .select('from_type, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);

  // Build conversation context for LLM
  const chatHistory = (messages || []).map(m => ({
    role: m.from_type === 'agent' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }));

  // Add the new incoming message
  chatHistory.push({ role: 'user' as const, content: incomingMessage });

  // Get lead info
  let leadContext = '';
  if (convo.lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', convo.lead_id)
      .single();

    if (lead) {
      leadContext = `\n[CONTEXTO: Lead ${lead.name}, ${lead.role}. Status: ${lead.status}. ${lead.notes || ''}]`;
    }
  }

  // Generate response
  const response = await callLLM([
    { role: 'system', content: LOKI_SYSTEM_PROMPT + leadContext },
    ...chatHistory,
  ]);

  // Send via WhatsApp
  const phone = convo.contact_phone;
  if (phone) {
    await sendTextMessage(phone, response.text);
  }

  // Save response
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    from_type: 'agent',
    content: response.text,
    metadata: {
      phone,
      agent_type: 'loki',
      llm_provider: response.provider,
      llm_model: response.model,
      contact_type: 'response',
      sent_via: 'loki_agent',
    },
  });

  // Update conversation
  await supabase
    .from('conversations')
    .update({ unread: 0, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // Check if meeting was scheduled (simple keyword detection)
  const meetingKeywords = ['reuniao', 'reunião', 'agenda', 'marcar', 'horario', 'horário', '12h', '18h', 'meet'];
  const hasMeetingTopic = meetingKeywords.some(k =>
    response.text.toLowerCase().includes(k) || incomingMessage.toLowerCase().includes(k)
  );

  if (hasMeetingTopic && convo.lead_id) {
    await supabase
      .from('leads')
      .update({ status: 'reuniao', updated_at: new Date().toISOString() })
      .eq('id', convo.lead_id);
  }

  await logAction(
    `Respondeu ${convo.contact_name}: "${response.text.substring(0, 60)}..." via ${response.provider}`,
    { conversation_id: conversationId }
  );

  return NextResponse.json({
    ok: true,
    message_sent: response.text,
    provider: response.provider,
  });
}

// ═══ FOLLOW-UP — FUP diario (1 msg/dia, 3 dias) ═══

async function handleFollowUp(body: { conversationId: string }) {
  const { conversationId } = body;

  // GUARD: Só faz FUP em leads do HAWKEYE
  const convo = await assertHawkeyeConversation(conversationId);
  if (!convo) {
    console.log(`[LOKI] Ignorando FUP em conversa ${conversationId} — não é lead do HAWKEYE`);
    return NextResponse.json({ error: 'Not a HAWKEYE lead. LOKI ignoring.' }, { status: 403 });
  }

  // Count existing FUP messages
  const { data: fupMessages } = await supabase
    .from('messages')
    .select('id, metadata')
    .eq('conversation_id', conversationId)
    .eq('from_type', 'agent')
    .order('created_at', { ascending: false })
    .limit(10);

  const fupCount = (fupMessages || []).filter(
    m => m.metadata?.contact_type === 'followup'
  ).length;

  // Max 3 FUPs
  if (fupCount >= 3) {
    // Mark as lost after 3 FUPs without response
    if (convo.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'perdido', updated_at: new Date().toISOString() })
        .eq('id', convo.lead_id);
    }

    await supabase
      .from('conversations')
      .update({ status: 'encerrado', updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    await logAction(`FUP #3 ja enviado para ${convo.contact_name}. Lead marcado como perdido.`);

    return NextResponse.json({ ok: true, action: 'closed', reason: 'max_fup_reached' });
  }

  // Get last messages for context
  const { data: history } = await supabase
    .from('messages')
    .select('from_type, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(10);

  const chatHistory = (history || []).map(m => ({
    role: m.from_type === 'agent' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }));

  // Generate FUP message
  const response = await callLLM([
    { role: 'system', content: LOKI_SYSTEM_PROMPT },
    ...chatHistory,
    {
      role: 'user',
      content: `[SISTEMA: O sindico nao respondeu. Gere o follow-up #${fupCount + 1} de 3.

FUP 1: Lembrete leve, mencione um beneficio novo
FUP 2: Compartilhe um case de sucesso rapido ou dado
FUP 3: Ultimo contato, deixe porta aberta

Seja breve (max 2 paragrafos). Nao repita a mensagem anterior.]`,
    },
  ]);

  // Send
  const phone = convo.contact_phone;
  if (phone) {
    await sendTextMessage(phone, response.text);
  }

  // Save
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    from_type: 'agent',
    content: response.text,
    metadata: {
      phone,
      agent_type: 'loki',
      llm_provider: response.provider,
      contact_type: 'followup',
      fup_number: fupCount + 1,
      sent_via: 'loki_agent',
    },
  });

  await logAction(
    `FUP #${fupCount + 1} enviado para ${convo.contact_name} via ${response.provider}`,
    { conversation_id: conversationId, fup_number: fupCount + 1 }
  );

  return NextResponse.json({
    ok: true,
    fup_number: fupCount + 1,
    message_sent: response.text,
    provider: response.provider,
  });
}

// ═══ BATCH: Contatos iniciais do dia (3 as 9h, 3 as 10h, 4 as 11h) ═══

async function handleBatchContacts() {
  const now = new Date();
  const currentHour = now.getHours();

  // Determine which batch based on current hour
  let batchSize: number;
  if (currentHour === 9) batchSize = 3;
  else if (currentHour === 10) batchSize = 3;
  else if (currentHour === 11) batchSize = 4;
  else {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Current hour is ${currentHour}. Batches run at 9, 10, 11.`,
    });
  }

  // Find conversations with status 'novo' — SOMENTE leads do HAWKEYE (com lead_id)
  const { data: newConvos } = await supabase
    .from('conversations')
    .select('id, contact_name, contact_phone, lead_id')
    .eq('agent_type', 'loki')
    .eq('status', 'aguardando')
    .eq('channel', 'whatsapp')
    .not('contact_phone', 'is', null)
    .not('lead_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (!newConvos || newConvos.length === 0) {
    return NextResponse.json({ ok: true, contacted: 0, reason: 'No new leads to contact' });
  }

  const results = [];
  for (const convo of newConvos) {
    try {
      // Add small random delay between messages (1-3 min spacing simulated)
      const result = await handleFirstContact({
        conversationId: convo.id,
        leadId: convo.lead_id,
      });
      const data = await result.json();
      results.push({ id: convo.id, name: convo.contact_name, ok: data.ok });
    } catch (err) {
      results.push({ id: convo.id, name: convo.contact_name, ok: false, error: String(err) });
    }
  }

  await logAction(
    `Batch ${currentHour}h: ${results.filter(r => r.ok).length}/${newConvos.length} contatos enviados`,
    { hour: currentHour, results }
  );

  return NextResponse.json({ ok: true, hour: currentHour, batch_size: batchSize, results });
}

// ═══ BATCH: FUPs do dia (horarios aleatorios 8-18h) ═══

async function handleBatchFollowups() {
  // Find conversations that need FUP:
  // - Status 'ativo'
  // - Last message was from agent (no reply)
  // - Last message was >24h ago
  // - Less than 3 FUPs sent

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // SOMENTE leads do HAWKEYE (com lead_id vinculado)
  const { data: activeConvos } = await supabase
    .from('conversations')
    .select('id, contact_name, contact_phone, lead_id, updated_at')
    .eq('agent_type', 'loki')
    .eq('status', 'ativo')
    .eq('channel', 'whatsapp')
    .lt('updated_at', oneDayAgo)
    .not('contact_phone', 'is', null)
    .not('lead_id', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(10);

  if (!activeConvos || activeConvos.length === 0) {
    return NextResponse.json({ ok: true, followups: 0, reason: 'No conversations need FUP' });
  }

  const results = [];
  for (const convo of activeConvos) {
    try {
      // Check if last message was from agent (means no reply)
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('from_type')
        .eq('conversation_id', convo.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastMsg?.[0]?.from_type !== 'agent') {
        continue; // Syndic replied, no FUP needed
      }

      const result = await handleFollowUp({ conversationId: convo.id });
      const data = await result.json();
      results.push({ id: convo.id, name: convo.contact_name, ...data });
    } catch (err) {
      results.push({ id: convo.id, name: convo.contact_name, ok: false, error: String(err) });
    }
  }

  await logAction(
    `Batch FUP: ${results.filter(r => r.ok).length} follow-ups enviados`,
    { results }
  );

  return NextResponse.json({ ok: true, followups_sent: results.length, results });
}

// ═══ SCHEDULE MEETING — Agendamento com email ═══

async function handleScheduleMeeting(body: {
  conversationId: string;
  contactEmail: string;
  preferredDate?: string;
  preferredTime?: 'noon' | 'evening';
  isVideo?: boolean;
}) {
  const { conversationId, contactEmail, preferredDate, preferredTime, isVideo } = body;

  // GUARD: Só faz agendamento em leads do HAWKEYE
  const convo = await assertHawkeyeConversation(conversationId);
  if (!convo) {
    return NextResponse.json({ error: 'Not a HAWKEYE lead.' }, { status: 403 });
  }

  const { scheduleMetodoing } = await import('@/lib/loki-calendar');

  const result = await scheduleMetodoing({
    conversationId,
    leadId: convo.lead_id,
    contactName: convo.contact_name,
    contactEmail,
    contactPhone: convo.contact_phone || '',
    preferredDate,
    preferredTime: preferredTime || 'noon',
    isVideo: isVideo !== false, // default true (Google Meet)
  });

  // Update conversation status
  await supabase
    .from('conversations')
    .update({
      status: 'reuniao_agendada',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  // Update lead status
  if (convo.lead_id) {
    await supabase
      .from('leads')
      .update({
        status: 'reuniao_agendada',
        email: contactEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', convo.lead_id);
  }

  await logAction(`Reunião agendada: ${convo.contact_name} → ${contactEmail}`, {
    conversation_id: conversationId,
    email: contactEmail,
  });

  return NextResponse.json({ ...result });
}

// ═══ HELPERS ═══

async function logAction(action: string, detail?: Record<string, unknown>) {
  try {
    await supabase.from('agent_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      agent_type: 'loki',
      action,
      detail: detail ? JSON.stringify(detail) : null,
      metadata: { source: 'loki_agent' },
    });
  } catch {
    console.log(`[LOKI] Log: ${action}`);
  }
}

// Health check
export async function GET() {
  const providers = getAvailableProviders();
  return NextResponse.json({
    agent: 'loki',
    status: providers.length > 0 ? 'ready' : 'no_llm_configured',
    available_providers: providers,
    schedule: {
      first_contact: '3 as 9h, 3 as 10h, 4 as 11h',
      followup: '1/dia por 3 dias, horarios aleatorios 8-18h',
      meetings: '12-13h ou 18h+, seg-sab',
    },
    persona: 'Joao Salvatori — Diretor Comercial',
    timestamp: new Date().toISOString(),
  });
}
