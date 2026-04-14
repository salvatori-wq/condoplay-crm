// ═══ SERVER-SIDE SUPABASE CLIENT (with service key) ═══
// Use this in API routes, webhooks, and agent code.
// Do NOT use in client components.

import { createClient } from '@supabase/supabase-js';
import { requireSupabaseConfig } from './env';

const { url, serviceKey } = requireSupabaseConfig();

export const supabaseServer = createClient(url, serviceKey);
