// ═══ ENV VALIDATION — Fail fast on missing config ═══

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[ENV] Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string = ''): string {
  return process.env[name] || fallback;
}

// ═══ SUPABASE ═══
// Client-side: graceful fallback (queries will fail but page renders)
// Server-side (supabase-server.ts): fail fast on missing config
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || anonKey;

  if (!url && typeof window === 'undefined') {
    console.error('[ENV] NEXT_PUBLIC_SUPABASE_URL not set — Supabase calls will fail');
  }

  return { url, serviceKey, anonKey };
}

// Strict version for server-side only (API routes, webhooks, agents)
export function requireSupabaseConfig() {
  return {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    serviceKey: optionalEnv('SUPABASE_SERVICE_KEY') || requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

// ═══ EVOLUTION API ═══
export function getEvolutionConfig() {
  return {
    url: requireEnv('NEXT_PUBLIC_EVOLUTION_API_URL'),
    apiKey: requireEnv('EVOLUTION_API_KEY'),
    instance: optionalEnv('NEXT_PUBLIC_EVOLUTION_INSTANCE', 'condoplay'),
  };
}

// ═══ APP URL ═══
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3002')
  );
}

// ═══ DEFAULT TENANT ═══
export const DEFAULT_TENANT_ID = 'aaaa0001-0000-0000-0000-000000000001';
