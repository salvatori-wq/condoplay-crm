// ═══ CONDO PLAY CRM — Database Types ═══

export type AgentType = 'hawkeye' | 'loki' | 'fury' | 'jarvis' | 'vision' | 'stark' | 'storm' | 'tibia';
export type LeadStatus = 'prospectado' | 'em_contato' | 'reuniao' | 'proposta' | 'fechado' | 'perdido';
export type CondoStatus = 'implantacao' | 'ativo' | 'pausado' | 'cancelado';
export type ConversationStatus = 'ativo' | 'aguardando' | 'encerrado' | 'alerta';
export type InvoiceStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type ContentType = 'carrossel' | 'post' | 'reels' | 'story';
export type Difficulty = 'facil' | 'medio' | 'dificil';
export type Channel = 'whatsapp' | 'email' | 'instagram' | 'interno';
export type UserRole = 'admin' | 'operator' | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  region: string | null;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  role: UserRole;
  name: string;
  email: string;
  created_at: string;
}

export interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  source_cost: number;
  status: LeadStatus;
  qualified: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Condo {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  units: number | null;
  sindico_lead_id: string | null;
  status: CondoStatus;
  monthly_plan: number;
  onboarded_at: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  name: string;
  category: string | null;
  min_players: number;
  max_players: number;
  difficulty: Difficulty | null;
  tutorial_url: string | null;
  created_at: string;
}

export interface CondoGame {
  id: string;
  condo_id: string;
  game_id: string;
  status: 'disponivel' | 'emprestado' | 'manutencao' | 'retirado';
  installed_at: string;
  next_swap_at: string | null;
  game?: Game;
}

export interface Checkout {
  id: string;
  condo_game_id: string;
  condo_id: string;
  tenant_id: string;
  resident_name: string;
  apt: string;
  checked_out_at: string;
  checked_in_at: string | null;
  hours_elapsed: number | null;
  fee_charged: number;
  created_at: string;
  condo_game?: CondoGame & { game?: Game };
  condo?: Condo;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  condo_id: string | null;
  agent_type: AgentType;
  channel: Channel;
  contact_name: string | null;
  contact_role: string | null;
  status: ConversationStatus;
  unread: number;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  from_type: 'agent' | 'contact' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Invoice {
  id: string;
  condo_id: string;
  tenant_id: string;
  month: string;
  plan_amount: number;
  extra_fees: number;
  total: number;
  status: InvoiceStatus;
  paid_at: string | null;
  created_at: string;
  condo?: Condo;
}

export interface SearchLog {
  id: string;
  tenant_id: string;
  source: string;
  query: string;
  cost: number;
  results_count: number;
  qualified_count: number;
  leads_found: string[];
  created_at: string;
}

export interface AgentLog {
  id: string;
  tenant_id: string;
  agent_type: AgentType;
  action: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ContentCalendar {
  id: string;
  tenant_id: string;
  day_of_week: number;
  theme: string | null;
  content_type: ContentType | null;
  content: string | null;
  scheduled_at: string | null;
  published: boolean;
  created_at: string;
}

// ═══ AGENT CONFIG ═══
export const AGENTS: Record<AgentType, { name: string; role: string; icon: string; color: string }> = {
  hawkeye: { name: 'HAWKEYE', role: 'Prospecção', icon: '🏹', color: '#22d3ee' },
  loki:    { name: 'LOKI',    role: 'Vendas',     icon: '🔱', color: '#a78bfa' },
  fury:    { name: 'FURY',    role: 'Implantação', icon: '🛡️', color: '#34d399' },
  jarvis:  { name: 'JARVIS',  role: 'Suporte',    icon: '🤖', color: '#fbbf24' },
  vision:  { name: 'VISION',  role: 'Operações',  icon: '👁️', color: '#f472b6' },
  stark:   { name: 'STARK',   role: 'Financeiro', icon: '💎', color: '#4ade80' },
  storm:   { name: 'STORM',   role: 'Marketing',  icon: '⚡', color: '#fb923c' },
  tibia:   { name: 'TIBIA',   role: 'Orquestrador', icon: '🧠', color: '#6366f1' },
};

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; icon: string }> = {
  prospectado: { label: 'Prospectado', color: '#22d3ee', icon: '🏹' },
  em_contato:  { label: 'Em Contato',  color: '#a78bfa', icon: '🔱' },
  reuniao:     { label: 'Reunião',     color: '#fbbf24', icon: '📅' },
  proposta:    { label: 'Proposta',    color: '#f472b6', icon: '📄' },
  fechado:     { label: 'Fechado',     color: '#4ade80', icon: '✅' },
  perdido:     { label: 'Perdido',     color: '#64748b', icon: '❌' },
};
