-- ═══ Migration: Conversation Features ═══
-- Adds: archived, loss_reason, loss_notes to conversations
-- Adds: agent_config table for pause control
-- Adds: 'perdido' status to conversations

-- 1. Add new columns to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS loss_reason text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS loss_notes text;

-- 2. Update status check constraint to include 'perdido'
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('ativo','aguardando','encerrado','alerta','perdido'));

-- 3. Index for filtering active (non-archived) conversations
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON conversations(tenant_id, archived) WHERE archived = false;

-- 4. Agent config table (pause control per agent per tenant)
CREATE TABLE IF NOT EXISTS agent_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  agent_type text NOT NULL,
  paused boolean DEFAULT false,
  paused_at timestamptz,
  paused_by text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, agent_type)
);
CREATE INDEX IF NOT EXISTS idx_agent_config_tenant ON agent_config(tenant_id);

-- 5. RLS for agent_config
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON agent_config FOR ALL USING (tenant_id = auth_tenant_id());

-- 6. Realtime for agent_config
ALTER PUBLICATION supabase_realtime ADD TABLE agent_config;
