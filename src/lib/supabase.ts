import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './env';

const { url, anonKey } = getSupabaseConfig();

export const supabase = createClient(url, anonKey);
