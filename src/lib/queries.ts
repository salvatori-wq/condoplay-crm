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
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  // Default: hide archived unless explicitly requested
  const useArchiveFilter = opts?.archived !== undefined ? true : true;
  if (useArchiveFilter) {
    query = query.eq('archived', opts?.archived === true ? true : false);
  }

  if (opts?.agentType) {
    query = query.eq('agent_type', opts.agentType);
  }
  if (opts?.status) {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query;

  // Fallback: if query fails (e.g. archived column doesn't exist yet), retry without new columns
  if (error) {
    let fallback = supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (opts?.agentType) fallback = fallback.eq('agent_type', opts.agentType);
    if (opts?.status) fallback = fallback.eq('status', opts.status);
    const { data: fbData, error: fbError } = await fallback;
    if (fbError) throw fbError;
    return (fbData || []).map(c => ({ archived: false, loss_reason: null, loss_notes: null, contact_phone: null, ...c })) as Conversation[];
  }

  return data as Conversation[];
}

// ═══ AGENT CONFIG (pause status) ═══
export async function getAgentConfigs() {
  const { data, error } = await supabase
    .from('agent_config')
    .select('*');
  if (error) throw error;
  return data as AgentConfig[];
}

export async function getMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Message[];
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
