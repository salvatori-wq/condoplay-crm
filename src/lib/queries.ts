import { supabase } from './supabase';
import type { AgentLog, AgentConfig, Conversation, Message, SearchLog, Condo, Lead, Invoice, ContentCalendar, Checkout, AgentType } from '@/types/database';

// ═══ COLUMN SELECTORS ═══
// Listas explícitas evitam o custo de `select('*')` (que traz todas as colunas,
// incluindo JSONB pesados como `metadata`). Sempre que possível pedimos só o
// que a UI usa. Se uma tela precisar de campo extra, adicionar aqui.

const LEAD_COLS =
  'id,tenant_id,name,role,phone,email,source,source_cost,status,qualified,notes,metadata,created_at,updated_at';

const CONDO_COLS =
  'id,tenant_id,name,address,units,sindico_lead_id,status,monthly_plan,onboarded_at,created_at';

const CONVERSATION_COLS =
  'id,tenant_id,lead_id,condo_id,agent_type,channel,contact_name,contact_phone,contact_role,status,unread,archived,loss_reason,loss_notes,created_at,updated_at';

const MESSAGE_COLS = 'id,conversation_id,from_type,content,metadata,created_at';

const INVOICE_COLS =
  'id,condo_id,tenant_id,month,plan_amount,extra_fees,total,status,paid_at,created_at';

const SEARCH_LOG_COLS =
  'id,tenant_id,source,query,cost,results_count,qualified_count,leads_found,created_at';

const AGENT_LOG_COLS = 'id,tenant_id,agent_type,action,detail,metadata,created_at';

const CHECKOUT_COLS =
  'id,condo_game_id,condo_id,tenant_id,resident_name,apt,checked_out_at,checked_in_at,hours_elapsed,fee_charged,created_at';

const CONTENT_CALENDAR_COLS =
  'id,tenant_id,day_of_week,theme,content_type,content,scheduled_at,published,created_at';

// ═══ PAGINATION ═══

export interface PageOpts {
  /** Zero-based page index. Default 0. */
  page?: number;
  /** Page size. Default 50, max 200. */
  pageSize?: number;
}

function rangeFor(opts?: PageOpts): { from: number; to: number } {
  const page = Math.max(0, opts?.page ?? 0);
  const size = Math.min(200, Math.max(1, opts?.pageSize ?? 50));
  const from = page * size;
  return { from, to: from + size - 1 };
}

// ═══ AGENT LOGS ═══
export async function getAgentLogs(limit = 25) {
  const { data, error } = await supabase
    .from('agent_logs')
    .select(AGENT_LOG_COLS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as AgentLog[];
}

// ═══ LEADS ═══
export async function getLeads(opts?: PageOpts) {
  const { from, to } = rangeFor(opts);
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_COLS)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []) as Lead[];
}

// ═══ CONDOS ═══
export async function getCondos() {
  const { data, error } = await supabase
    .from('condos')
    .select(CONDO_COLS)
    .order('name');
  if (error) throw error;
  return (data || []) as Condo[];
}

// ═══ CONVERSATIONS ═══
export async function getConversations(
  opts?: { agentType?: AgentType; archived?: boolean; status?: string } & PageOpts
) {
  const { from, to } = rangeFor(opts);
  let query = supabase
    .from('conversations')
    .select(CONVERSATION_COLS)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (opts?.agentType) {
    query = query.eq('agent_type', opts.agentType);
  }
  if (opts?.status) {
    query = query.eq('status', opts.status);
  }
  if (opts?.archived !== undefined) {
    query = query.eq('archived', opts.archived);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Conversation[];
}

// ═══ AGENT CONFIG (pause status) ═══
export async function getAgentConfigs() {
  const { data, error } = await supabase
    .from('AgentConfig')
    .select('id,tenant_id,agent_type,paused,paused_at,paused_by,updated_at');
  if (error) return [] as AgentConfig[];
  return (data || []) as AgentConfig[];
}

export async function getMessages(conversationId: string, opts?: PageOpts) {
  const { from, to } = rangeFor({ pageSize: opts?.pageSize ?? 200, page: opts?.page });
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(from, to);
  if (error) throw error;
  return (data || []) as Message[];
}

// ═══ SEARCH LOGS ═══
export async function getSearchLogs(opts?: PageOpts) {
  const { from, to } = rangeFor(opts);
  const { data, error } = await supabase
    .from('search_logs')
    .select(SEARCH_LOG_COLS)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []) as SearchLog[];
}

// ═══ INVOICES ═══
export async function getInvoices(opts?: PageOpts) {
  const { from, to } = rangeFor(opts);
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_COLS)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []) as Invoice[];
}

// ═══ CHECKOUTS ═══
export async function getCheckouts(opts?: PageOpts) {
  const { from, to } = rangeFor(opts);
  const { data, error } = await supabase
    .from('checkouts')
    .select(`${CHECKOUT_COLS}, condo:condos(name)`)
    .order('checked_out_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []) as unknown as (Checkout & { condo: { name: string } })[];
}

// ═══ CONTENT CALENDAR ═══
export async function getContentCalendar() {
  const { data, error } = await supabase
    .from('content_calendar')
    .select(CONTENT_CALENDAR_COLS)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data || []) as ContentCalendar[];
}

// ═══ GAMES ═══
export async function getGames() {
  const { data, error } = await supabase
    .from('games')
    .select('id,name,category,min_players,max_players,difficulty,tutorial_url,created_at')
    .order('name');
  if (error) throw error;
  return data || [];
}

// ═══ CONDO GAMES ═══
export async function getCondoGames(condoId: string) {
  const { data, error } = await supabase
    .from('condo_games')
    .select(
      'id,condo_id,game_id,status,installed_at,next_swap_at, game:games(id,name,category,min_players,max_players,difficulty)'
    )
    .eq('condo_id', condoId);
  if (error) throw error;
  return data || [];
}

// ═══ KPIs ═══
export async function getDashboardKpis() {
  const [condos, conversations, searchLogs, agentLogs] = await Promise.all([
    getCondos(),
    getConversations({ pageSize: 200 }),
    getSearchLogs({ pageSize: 100 }),
    getAgentLogs(),
  ]);

  const activeCondos = condos.filter(c => c.status === 'ativo');
  const mrr = activeCondos.reduce((s, c) => s + Number(c.monthly_plan), 0);
  const totalSearchCost = searchLogs.reduce((s, h) => s + Number(h.cost), 0);
  const totalLeads = searchLogs.reduce((s, h) => s + h.qualified_count, 0);
  const alertas = conversations.filter(c => c.status === 'alerta').length;

  return { mrr, activeCondos: activeCondos.length, conversations: conversations.length, totalLeads, totalSearchCost, alertas, agentLogs };
}
