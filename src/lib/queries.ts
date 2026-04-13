import { supabase } from './supabase';
import type { AgentLog, AgentConfig, Conversation, Message, SearchLog, Condo, Lead, Invoice, ContentCalendar, Checkout, AgentType } from '@/types/database';

// ═══ AGENT LOGS ═══
export async function getAgentLogs(limit = 25) {
  const { data, error } = await supabase
    .from('agent_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AgentLog[];
}

// ═══ LEADS ═══
export async function getLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Lead[];
}

// ═══ CONDOS ═══
export async function getCondos() {
  const { data, error } = await supabase
    .from('condos')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Condo[];
}

// ═══ CONVERSATIONS ═══
export async function getConversations(opts?: { agentType?: AgentType; archived?: boolean; status?: string }) {
  let query = supabase
    .from('WhatsAppConversa')
    .select('*')
    .order('atualizadoEm', { ascending: false });

  // Default: hide archived unless explicitly requested
  query = query.eq('arquivada', opts?.archived === true ? true : false);

  if (opts?.agentType) {
    query = query.eq('tipo', opts.agentType);
  }
  if (opts?.status) {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query;

  if (error) {
    // Fallback: retry without arquivada filter (column might not exist yet)
    let fallback = supabase
      .from('WhatsAppConversa')
      .select('*')
      .order('atualizadoEm', { ascending: false });
    if (opts?.agentType) fallback = fallback.eq('tipo', opts.agentType);
    if (opts?.status) fallback = fallback.eq('status', opts.status);
    const { data: fbData, error: fbError } = await fallback;
    if (fbError) throw fbError;
    return (fbData || []).map(c => ({
      ...c,
      archived: false, loss_reason: null, loss_notes: null,
      // Map JARVIS schema to UI expected fields
      agent_type: c.tipo, contact_name: c.nomeContato, contact_phone: c.telefone,
      unread: c.naoLidas, updated_at: c.atualizadoEm, created_at: c.criadoEm,
    })) as unknown as Conversation[];
  }

  // Map JARVIS schema fields to UI expected shape
  return (data || []).map(c => ({
    ...c,
    agent_type: c.tipo, contact_name: c.nomeContato, contact_phone: c.telefone,
    unread: c.naoLidas, updated_at: c.atualizadoEm, created_at: c.criadoEm,
    archived: c.arquivada || false, loss_reason: c.motivoPerda, loss_notes: c.notasPerda,
    lead_id: c.leadId,
  })) as unknown as Conversation[];
}

// ═══ AGENT CONFIG (pause status) ═══
export async function getAgentConfigs() {
  const { data, error } = await supabase
    .from('AgentConfig')
    .select('*');
  if (error) return [] as AgentConfig[];
  return data as AgentConfig[];
}

export async function getMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('WhatsAppMensagem')
    .select('*')
    .eq('conversaId', conversationId)
    .order('criadoEm', { ascending: true });
  if (error) throw error;
  // Map to UI expected shape
  return (data || []).map(m => ({
    ...m,
    conversation_id: m.conversaId,
    from_type: m.direcao === 'ENVIADA' ? 'agent' : 'contact',
    content: m.conteudo,
    created_at: m.criadoEm,
    metadata: {},
  })) as unknown as Message[];
}

// ═══ SEARCH LOGS ═══
export async function getSearchLogs() {
  const { data, error } = await supabase
    .from('search_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as SearchLog[];
}

// ═══ INVOICES ═══
export async function getInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

// ═══ CHECKOUTS ═══
export async function getCheckouts() {
  const { data, error } = await supabase
    .from('checkouts')
    .select('*, condo:condos(name)')
    .order('checked_out_at', { ascending: false });
  if (error) throw error;
  return data as (Checkout & { condo: { name: string } })[];
}

// ═══ CONTENT CALENDAR ═══
export async function getContentCalendar() {
  const { data, error } = await supabase
    .from('content_calendar')
    .select('*')
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data as ContentCalendar[];
}

// ═══ GAMES ═══
export async function getGames() {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

// ═══ CONDO GAMES ═══
export async function getCondoGames(condoId: string) {
  const { data, error } = await supabase
    .from('condo_games')
    .select('*, game:games(*)')
    .eq('condo_id', condoId);
  if (error) throw error;
  return data;
}

// ═══ KPIs ═══
export async function getDashboardKpis() {
  const [condos, conversations, searchLogs, agentLogs] = await Promise.all([
    getCondos(),
    getConversations(),
    getSearchLogs(),
    getAgentLogs(),
  ]);

  const activeCondos = condos.filter(c => c.status === 'ativo');
  const mrr = activeCondos.reduce((s, c) => s + Number(c.monthly_plan), 0);
  const totalSearchCost = searchLogs.reduce((s, h) => s + Number(h.cost), 0);
  const totalLeads = searchLogs.reduce((s, h) => s + h.qualified_count, 0);
  const alertas = conversations.filter(c => c.status === 'alerta').length;

  return { mrr, activeCondos: activeCondos.length, conversations: conversations.length, totalLeads, totalSearchCost, alertas, agentLogs };
}
