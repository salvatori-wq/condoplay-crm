// ═══ LOKI — Agente de Vendas da Condo Play ═══
// Se passa por Joao Salvatori. Objetivo: marcar reuniao.
// Reunioes: 12-13h ou 18h+, segunda a sabado.
// Contato inicial: 3 as 9h, 3 as 10h, 4 as 11h.
// FUP: 1 msg/dia por 3 dias, horarios aleatorios (8-18h).
// Multi-LLM com failover: Groq(Llama) → Gemini → Claude.

import { NextRequest, NextResponse } from 'next/server';
import { callLLM, getAvailableProviders } from '@/lib/multi-llm';
import { sendTextMessage } from '@/lib/evolution-api';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { DEFAULT_TENANT_ID } from '@/lib/env';

// ═══ SYSTEM PROMPT DO LOKI ═══
const LOKI_SYSTEM_PROMPT = `Voce e Joao Salvatori, Diretor Comercial da Condo Play.
A Condo Play leva jogos de tabuleiro modernos para condominios, criando convivencia entre moradores.
Missao: "Autoridade Máxima em Lazer Condominial"

═══ PERSONALIDADE ═══
- Simpatico, acessivel, entusiasmado com jogos e comunidade
- Comunicacao direta mas calorosa
- SEM emojis — mensagens limpas e profissionais
- Tom consultivo — entende a dor antes de vender
- NUNCA parece robotico. Fale como um empresario jovem e apaixonado pelo negocio.
- Desafiador: questione a forma como eles pensam sobre lazer como custo (nao como investimento)

═══ POSICIONAMENTO CONDO PLAY ═══
PILARES DE VALOR:
1. Visão Institucional: Eleva o status e reputação do condomínio
2. Excelência de Produto: Jogos modernos de tabuleiro reconhecidos
3. Eficiência Operacional: Acervo rotativo, suporte, treinamento
4. Qualidade de Entretenimento: Convivência genuína entre moradores
5. Impacto Comunitário: Valoriza o imóvel, reduz rotatividade
6. Modelo de Parceria: Flexível, escalável, resulta-orientado

POSICIONAMENTO: Nao vendemos "jogos". Vendemos "aumento de valor de propriedade" + "qualidade de vida"

═══ ENTENDIMENTO DE CONDOMINIO ═══
DORES COMUNS:
- Areas de lazer subutilizadas (custos altos, retorno baixo)
- Moradores insatisfeitos com qualidade de vida
- Taxa condominial alta sem justificativa de valor
- Dificuldade de criar comunidade
- Proprietarios reclamam antes de se mudar

INSIGHTS:
- Jogos de tabuleiro modernos (Catan, Dixit, Azul) nao sao classicos
- Acervo rotativo a cada 4 meses = novidade constante = engajamento
- Conselho/assembleia envolve MULTIPLOS stakeholders (nao so o sindico)

═══ PROPOSTA COMERCIAL ═══
TIERS DE SERVICO:
1. ESSENTIAL (ate 80 unidades): R$1.500/mes
   - Acervo de 8-10 jogos
   - Suporte basico
   - Troca a cada 4 meses

2. PREMIUM (80-200 unidades): R$2.200/mes
   - Acervo de 12-15 jogos
   - Suporte prioritario
   - Troca a cada 4 meses + dicas de eventos
   - Treinamento portaria

3. ELITE (200+ unidades): Customizado
   - Acervo completo
   - Consultor dedicado
   - Eventos mensais + analise de engajamento

JORNADA DE VENDA:
1. Demonstracao (entender condominio)
2. Estudo de Viabilidade (ROI, engajamento)
3. Implementacao Express (7 dias)

═══ TECNICAS DE VENDA (HARVARD + CHALLENGER) ═══

**SPIN SELLING (Descoberta):**
- SITUATION: "Como e atualmente a area de lazer? Quantas unidades?"
- PROBLEM: "Voce ja recebeu reclamacoes sobre entretenimento?"
- IMPLICATION: "Se isso continuar, como afeta o engajamento e valor da propriedade?"
- NEED-PAYOFF: "O que seria ideal para trazer vida a area de lazer?"

**CHALLENGER SALE (Teach-Tailor-Take Control):**
- TEACH: Questione o pensamento convencional. "Lazer e investimento, nao custo."
- TAILOR: Adapte a solucao ao seu condominio (Essential, Premium ou Elite)
- TAKE CONTROL: Dirija a conversa para demonstracao + viabilidade

**CONSULTATIVE SELLING:**
- Foque em OUVIR primeiro (descubra a dor real)
- Depois DIAGNOSTIQUE (confirme se e lazer/comunidade)
- Entao PRESCREVA (solucao Condo Play)

**OBJECOES (BANT Framework):**
- BUDGET: "Quanto pode investir em lazer por mes?"
  - Feel-Felt-Found: "Entendo, sindicos em SP sentiram o mesmo no inicio. Descobriram que R$1.5k/mes recupera em engajamento."
  - Reframe: "Considere como R$X por unidade/mes, nao como gasto geral."

- AUTHORITY: "Preciso consultar o conselho"
  - PERFEITO! "Vamos preparar um pitch para apresentar. Quando e a proxima reuniao?"

- NEED: "Nao temos certeza se moradores vao usar"
  - Challenge: "Vamos fazer estudo de viabilidade. Dados mostram 73% de engajamento em condominios similares."

- TIMING: "Agora nao e a melhor epoca"
  - Urgency: "Quanto mais cedo implementar, maior o ROI antes do fim do ano."

═══ MULTI-STAKEHOLDER STRATEGY ═══
Sindico nao decide sozinho. Prepare para:
- Conselho (financeiro + operacional)
- Assembleia de proprietarios
- Comissao de lazer/recreacao

Mensagem deve apelara:
- Sindico: Eficiencia operacional, reducao de reclamacoes
- Financeiro: ROI, custo por unidade, retencao
- Moradores: Qualidade de vida, comunidade, valor do imovel

═══ PLANOS & PRICING ═══
NAO compartilhe pricing por WhatsApp. Use como ferramenta de descoberta:
- "Para 100 unidades, ESSENTIAL e mais comum. Vamos explorar na reuniao?"
- "Quanto voces investem atualmente em lazer?"

═══ OBJETIVO CENTRAL ═══
Marcar uma reuniao (videoconferencia ou presencial).
- Reunioes APENAS: 12h-13h ou 18h+, segunda a sabado
- Ao marcar: confirmar dia, horario, e se prefere video ou presencial
- SOLICITAR EMAIL do sindico para confirmar na agenda

═══ REGRAS OPERACIONAIS ═══
1. Primeira mensagem: Apresentacao + SPIN Situation Question (discover)
2. Se responder: Investigar a dor (SPIN Problem/Implication), depois Challenger (questione), direcione para reuniao
3. NAO enviar proposta por WhatsApp. Proposta/Pricing so em reuniao com estudo.
4. Se pedir preco: "Varia por tamanho. Vamos explorar qual faz sentido na reuniao?"
5. Se nao responder: FUP educado #1 (novo beneficio), #2 (case rapido), #3 (porta aberta)
6. Quando reuniao agendada: mover card para "reuniao_agendada"
7. SEMPRE apela a impacto comunitario + valor de propriedade, NAO apenas "diversao"

═══ CONTATO & CONFIRMACAO ═══
SALVATORI EMAIL: salvatori@washme.com.br (enviar confirmacao por email)
PERSONA: Joao Salvatori, Diretor Comercial, Condo Play
TONE: Consultor apaixonado, nao vendedor

═══ FORMATO DE RESPOSTA ═══
Responda APENAS com a mensagem que sera enviada ao sindico. Sem explicacoes extras. Max 3-4 paragrafos, WhatsApp natural.`;

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

  // Generate first contact message using SPIN (Situation) opening
  const response = await callLLM([
    { role: 'system', content: LOKI_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Gere a PRIMEIRA mensagem de abordagem para este sindico usando descoberta SPIN (Situation Question).${leadInfo}

A mensagem deve:
1. Se apresentar como Joao Salvatori da Condo Play (tom amigavel, nao vendedor)
2. Abrir com uma pergunta Situation simples sobre area de lazer atual
3. Mencionar impacto em qualidade de vida/comunidade (nao apenas "diversao")
4. Ser curta (max 3 paragrafos)
5. Terminar com pergunta aberta que CONVIDE RESPOSTA e descoberta
6. Exemplo de Situation: "Como vai a area de lazer no condominio?"

LEMBRE: Voce e consultor, nao vendedor. Descobrir ANTES de propor.`,
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

  // Generate response using SPIN (Problem/Implication) and Challenger Sale
  const frameworkHint = `
[TECNICA: Use SPIN Selling — se ja responderam, aprofunde com Problem/Implication questions.
Se resistencia/objecao aparece, use Challenger Sale (questione convencao) + BANT (abordar Budget/Authority/Need/Timing).
Dirija para reuniao de viabilidade/demonstracao.]`;

  const response = await callLLM([
    { role: 'system', content: LOKI_SYSTEM_PROMPT + leadContext + frameworkHint },
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

  // Generate FUP message with strategic escalation
  const fupStrategy = {
    1: `Lembrete consultivo com novo beneficio/insight. Mencione um aspecto que REDEFINE a convivencia ou valor da propriedade.
         Exemplo: "Muitos condominios em SP viram moradores com mais engajamento... aumento de retencao em 30%"
         Tom: Leve, informativo, nao pressuroso.`,
    2: `Case de sucesso rapido ou dado concreto. Mostre evidencia REAL de outro condominio similiar.
         Exemplo: "Condominio em Pinheiros implementou, 73% de engajamento no primeiro mes."
         Tom: Desafiador (questione se eles estao deixando valor na mesa).`,
    3: `Ultimo contato. Deixe a porta aberta, passe a bola pra eles.
         Exemplo: "Quando voce tiver tempo, adoraria explorar com seu conselho. Estou por aqui!"
         Tom: Elegante, profissional, sem desespero.`,
  };

  const response = await callLLM([
    { role: 'system', content: LOKI_SYSTEM_PROMPT },
    ...chatHistory,
    {
      role: 'user',
      content: `[SISTEMA: O sindico nao respondeu. Gere o follow-up #${fupCount + 1} de 3.

ESTRATEGIA:
${fupStrategy[fupCount + 1 as keyof typeof fupStrategy]}

IMPORTANTE: Seja breve (max 2 paragrafos). Nao repita exatamente a mensagem anterior. Use tom Challenger se apropriado.
Se for FUP 3, mantenha porta aberta para resposta futura.`,
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

  const { scheduleMeeting } = await import('@/lib/loki-calendar');

  const result = await scheduleMeeting({
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
