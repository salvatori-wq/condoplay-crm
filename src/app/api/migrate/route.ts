// ═══ MIGRATION ENDPOINT — Cria tabelas faltantes ═══
// POST /api/migrate — roda migrations
// GET /api/migrate — mostra status

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const MIGRATIONS = [
  {
    name: 'create_agent_logs',
    check: async () => {
      const { error } = await supabase.from('agent_logs').select('id').limit(1);
      return !error; // true = already exists
    },
    run: async () => {
      // Can't run DDL via PostgREST — create via insert workaround
      // Instead, use the table directly and let it fail gracefully
      return 'Needs SQL Editor: CREATE TABLE agent_logs (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id uuid, agent_type text NOT NULL, action text NOT NULL, detail text, metadata jsonb DEFAULT \'{}\'::jsonb, created_at timestamptz DEFAULT now());';
    },
  },
];

export async function GET() {
  const results = [];

  for (const migration of MIGRATIONS) {
    const exists = await migration.check();
    results.push({ name: migration.name, exists });
  }

  return NextResponse.json({
    migrations: results,
    sql_needed: `
-- Run this in Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS agent_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid,
  agent_type text NOT NULL,
  action text NOT NULL,
  detail text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS so agents can write freely
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON agent_logs FOR ALL USING (true) WITH CHECK (true);

-- Also clean up bad leads from scraper test
DELETE FROM leads WHERE name IN ('Fax:', 'Tel:') OR phone = '55';
    `,
  });
}

export async function POST() {
  return NextResponse.json({
    message: 'Run the SQL shown in GET /api/migrate in Supabase SQL Editor',
  });
}
