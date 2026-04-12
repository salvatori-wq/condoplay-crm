-- ═══════════════════════════════════════════════════════════
-- CONDO PLAY CRM — Supabase Schema
-- Multi-tenant, RLS nativo, preparado para 10k+ leads
-- ═══════════════════════════════════════════════════════════

-- Extensions
create extension if not exists "uuid-ossp";

-- ═══ TENANTS (Franquias) ═══
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  region text,
  created_at timestamptz default now()
);

-- ═══ USERS ═══
create table users (
  id uuid primary key references auth.users(id),
  tenant_id uuid not null references tenants(id),
  role text not null check (role in ('admin', 'operator', 'viewer')),
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- ═══ LEADS ═══
create table leads (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  role text, -- sindico, administrador, etc
  phone text,
  email text,
  source text, -- linkedin, google_maps, apollo, sindiconet, instagram
  source_cost numeric(10,2) default 0,
  status text not null default 'prospectado' check (status in ('prospectado','em_contato','reuniao','proposta','fechado','perdido')),
  qualified boolean default false,
  notes text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_leads_tenant on leads(tenant_id);
create index idx_leads_status on leads(tenant_id, status);

-- ═══ CONDOMINIOS ═══
create table condos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  address text,
  units integer,
  sindico_lead_id uuid references leads(id),
  status text not null default 'implantacao' check (status in ('implantacao','ativo','pausado','cancelado')),
  monthly_plan numeric(10,2) not null,
  onboarded_at timestamptz,
  created_at timestamptz default now()
);
create index idx_condos_tenant on condos(tenant_id);

-- ═══ GAMES ═══
create table games (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text,
  min_players integer default 2,
  max_players integer default 4,
  difficulty text check (difficulty in ('facil','medio','dificil')),
  tutorial_url text,
  created_at timestamptz default now()
);

-- ═══ CONDO GAMES (acervo por condomínio) ═══
create table condo_games (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references condos(id),
  game_id uuid not null references games(id),
  status text default 'disponivel' check (status in ('disponivel','emprestado','manutencao','retirado')),
  installed_at timestamptz default now(),
  next_swap_at timestamptz
);
create index idx_condo_games_condo on condo_games(condo_id);

-- ═══ CHECKOUTS (retirada/devolução de jogos) ═══
create table checkouts (
  id uuid primary key default uuid_generate_v4(),
  condo_game_id uuid not null references condo_games(id),
  condo_id uuid not null references condos(id),
  tenant_id uuid not null references tenants(id),
  resident_name text not null,
  apt text not null,
  checked_out_at timestamptz default now(),
  checked_in_at timestamptz,
  hours_elapsed numeric(10,2),
  fee_charged numeric(10,2) default 0,
  created_at timestamptz default now()
);
create index idx_checkouts_tenant on checkouts(tenant_id);
create index idx_checkouts_open on checkouts(condo_id) where checked_in_at is null;

-- ═══ CONVERSATIONS ═══
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  lead_id uuid references leads(id),
  condo_id uuid references condos(id),
  agent_type text not null check (agent_type in ('hawkeye','loki','fury','jarvis','vision','stark','storm','tibia')),
  channel text default 'whatsapp' check (channel in ('whatsapp','email','instagram','interno')),
  contact_name text,
  contact_role text,
  status text default 'ativo' check (status in ('ativo','aguardando','encerrado','alerta')),
  unread integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_conversations_tenant on conversations(tenant_id);

-- ═══ MESSAGES ═══
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  from_type text not null check (from_type in ('agent','contact','system')),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index idx_messages_conversation on messages(conversation_id);

-- ═══ INVOICES (Fechamento mensal) ═══
create table invoices (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references condos(id),
  tenant_id uuid not null references tenants(id),
  month text not null, -- '2026-04'
  plan_amount numeric(10,2) not null,
  extra_fees numeric(10,2) default 0,
  total numeric(10,2) not null,
  status text default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index idx_invoices_tenant on invoices(tenant_id);

-- ═══ SEARCH LOGS (Buscas do HAWKEYE) ═══
create table search_logs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  source text not null,
  query text not null,
  cost numeric(10,4) default 0,
  results_count integer default 0,
  qualified_count integer default 0,
  leads_found jsonb default '[]',
  created_at timestamptz default now()
);
create index idx_search_logs_tenant on search_logs(tenant_id);

-- ═══ AGENT LOGS (Feed TIBIA) ═══
create table agent_logs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  agent_type text not null check (agent_type in ('hawkeye','loki','fury','jarvis','vision','stark','storm','tibia')),
  action text not null,
  detail text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index idx_agent_logs_tenant on agent_logs(tenant_id);
create index idx_agent_logs_created on agent_logs(tenant_id, created_at desc);

-- ═══ CONTENT CALENDAR (Instagram STORM) ═══
create table content_calendar (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  day_of_week integer check (day_of_week between 0 and 6),
  theme text,
  content_type text check (content_type in ('carrossel','post','reels','story')),
  content text,
  scheduled_at timestamptz,
  published boolean default false,
  created_at timestamptz default now()
);
create index idx_content_calendar_tenant on content_calendar(tenant_id);

-- ═══ SUPPLIERS ═══
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact text,
  games_available integer default 0,
  notes text,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Multi-tenant isolation
-- ═══════════════════════════════════════════════════════════

alter table tenants enable row level security;
alter table users enable row level security;
alter table leads enable row level security;
alter table condos enable row level security;
alter table condo_games enable row level security;
alter table checkouts enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table invoices enable row level security;
alter table search_logs enable row level security;
alter table agent_logs enable row level security;
alter table content_calendar enable row level security;

-- Helper function: get tenant_id from auth
create or replace function auth_tenant_id() returns uuid as $$
  select tenant_id from users where id = auth.uid()
$$ language sql security definer stable;

-- Tenant policy template
create policy "tenant_isolation" on tenants for all using (id = auth_tenant_id());
create policy "tenant_isolation" on users for all using (tenant_id = auth_tenant_id());
create policy "tenant_isolation" on leads for all using (tenant_id = auth_tenant_id());
create policy "tenant_isolation" on condos for all using (tenant_id = auth_tenant_id());
create policy "tenant_isolation" on checkouts for all using (tenant_id = auth_tenant_id());
create policy "tenant_isolation" on conversations for all using (tenant_id = auth_tenant_id());
create policy "tenant_isolation" on invoices for all using (tenant_id = auth_tenant_id());
create policy "tenant_isolation" on search_logs for all using (tenant_id = auth_tenant_id());
create policy "tenant_isolation" on agent_logs for all using (tenant_id = auth_tenant_id());
create policy "tenant_isolation" on content_calendar for all using (tenant_id = auth_tenant_id());

-- condo_games via condo.tenant_id
create policy "tenant_isolation" on condo_games for all using (
  exists (select 1 from condos where condos.id = condo_games.condo_id and condos.tenant_id = auth_tenant_id())
);

-- messages via conversation.tenant_id
create policy "tenant_isolation" on messages for all using (
  exists (select 1 from conversations where conversations.id = messages.conversation_id and conversations.tenant_id = auth_tenant_id())
);

-- games e suppliers: públicos (sem tenant_id)
alter table games enable row level security;
create policy "public_read" on games for select using (true);
alter table suppliers enable row level security;
create policy "public_read" on suppliers for select using (true);

-- ═══ REALTIME ═══
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table agent_logs;
alter publication supabase_realtime add table checkouts;

-- ═══ UPDATED_AT TRIGGER ═══
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on leads for each row execute function update_updated_at();
create trigger set_updated_at before update on conversations for each row execute function update_updated_at();
