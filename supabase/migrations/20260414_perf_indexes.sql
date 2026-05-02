-- ═══ PERFORMANCE INDEXES ═══
-- Objetivo: reduzir latência e custo de leitura no Supabase.
-- Todos os índices são IF NOT EXISTS para idempotência.
-- Todos usam CONCURRENTLY para não bloquear leituras em produção.
-- Rodar com: psql < este arquivo  (ou via Supabase SQL editor SEM envolver em transação).

-- Leads: filtro padrão é (tenant_id, status) ordenado por created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_tenant_status_created
  ON leads (tenant_id, status, created_at DESC);

-- Dedup Hawkeye: busca por telefone normalizado
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_phone
  ON leads (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_email
  ON leads (email)
  WHERE email IS NOT NULL;

-- Conversations: listagem por agent + status + arquivado, ordenada por updated_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_tenant_agent_status_updated
  ON conversations (tenant_id, agent_type, status, archived, updated_at DESC);

-- Messages: always scoped por conversation_id ordenado por created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conv_created
  ON messages (conversation_id, created_at);

-- Agent logs: feed ordenado por created_at por tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_logs_tenant_created
  ON agent_logs (tenant_id, created_at DESC);

-- Search logs: idem
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_logs_tenant_created
  ON search_logs (tenant_id, created_at DESC);

-- Invoices: filtro por (tenant, status) em financeiro
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_status_created
  ON invoices (tenant_id, status, created_at DESC);

-- Checkouts: listagem por data decrescente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkouts_tenant_checkedout
  ON checkouts (tenant_id, checked_out_at DESC);

-- Condo games: lookup por condo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_condo_games_condo
  ON condo_games (condo_id);

-- Condos: filtro por (tenant, status) usado em KPIs (MRR)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_condos_tenant_status
  ON condos (tenant_id, status);

-- AgentConfig: lookup por agent_type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_config_tenant_agent
  ON "AgentConfig" (tenant_id, agent_type);

-- ANALYZE para atualizar estatísticas do planner
ANALYZE leads;
ANALYZE conversations;
ANALYZE messages;
ANALYZE agent_logs;
ANALYZE search_logs;
ANALYZE invoices;
ANALYZE checkouts;
ANALYZE condos;
