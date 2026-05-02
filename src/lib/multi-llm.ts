// ═══ MULTI-LLM CLIENT — Failover entre Claude, Gemini, Groq (Llama/Grok) ═══
//
// Features:
//   - Failover automático: Groq → Gemini → Claude (custo crescente).
//   - Prompt caching no Claude (cache_control em system prompt) — economia ~80% quando prompt
//     é reutilizado dentro de 5 min.
//   - Seleção de modelo por chamada via `task`:
//       'heavy'  → Claude Sonnet 4 / Llama 3.3 70B / Gemini Flash (default resposta ao lead)
//       'light'  → Claude Haiku 4.5 / Llama 3.1 8B / Gemini Flash Lite (classificação, resumo curto)
//     Usar 'light' em intent classification e tarefas triviais reduz custo em ~10x no Claude.

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export type LLMProvider = 'claude' | 'gemini' | 'groq';
export type LLMTask = 'heavy' | 'light';

interface LLMResponse {
  text: string;
  provider: LLMProvider;
  model: string;
  tokens?: number;
  cacheHit?: boolean; // true se prompt cache do Claude foi usado
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMCallOptions {
  maxTokens?: number;
  preferredProvider?: LLMProvider;
  fallbackOrder?: LLMProvider[];
  task?: LLMTask;
  /**
   * Se true, adiciona cache_control ao system prompt do Claude.
   * Habilita prompt caching (TTL 5 min). Recomendado quando o system prompt
   * tem >1024 tokens e é reutilizado em chamadas próximas.
   * Default: true.
   */
  cacheSystemPrompt?: boolean;
}

// ═══ MODEL SELECTION ═══

const MODELS = {
  claude: {
    heavy: 'claude-sonnet-4-20250514',
    light: 'claude-haiku-4-5-20251001',
  },
  gemini: {
    heavy: 'gemini-2.0-flash',
    light: 'gemini-2.0-flash-lite',
  },
  groq: {
    heavy: 'llama-3.3-70b-versatile',
    light: 'llama-3.1-8b-instant',
  },
} as const;

// ═══ PROVIDER CLIENTS ═══

function getClaudeClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

function getGroqClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

// ═══ INDIVIDUAL PROVIDERS ═══

async function callClaude(
  messages: LLMMessage[],
  maxTokens: number,
  task: LLMTask,
  cacheSystemPrompt: boolean
): Promise<LLMResponse> {
  const client = getClaudeClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured');

  const model = MODELS.claude[task];
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMsgs = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Prompt caching: envia system como array de blocks com cache_control ephemeral.
  // Requer que o system prompt seja >1024 tokens (Haiku) ou >2048 (Sonnet) para criar o cache.
  // Em prompts menores, Anthropic retorna normal (sem criar cache) — no-op seguro.
  const systemParam = systemMsg
    ? cacheSystemPrompt
      ? [{ type: 'text' as const, text: systemMsg, cache_control: { type: 'ephemeral' as const } }]
      : systemMsg
    : undefined;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(systemParam ? { system: systemParam } : {}),
    messages: chatMsgs,
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  const usage = response.usage as
    | { output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
    | undefined;

  return {
    text,
    provider: 'claude',
    model,
    tokens: usage?.output_tokens,
    cacheHit: (usage?.cache_read_input_tokens ?? 0) > 0,
  };
}

async function callGemini(
  messages: LLMMessage[],
  maxTokens: number,
  task: LLMTask
): Promise<LLMResponse> {
  const client = getGeminiClient();
  if (!client) throw new Error('GEMINI_API_KEY not configured');

  const modelId = MODELS.gemini[task];
  const model = client.getGenerativeModel({ model: modelId });

  // Build prompt from messages
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatHistory = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = systemMsg ? `${systemMsg}\n\n${chatHistory}` : chatHistory;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  });

  const text = result.response.text();

  return {
    text,
    provider: 'gemini',
    model: modelId,
  };
}

async function callGroq(
  messages: LLMMessage[],
  maxTokens: number,
  task: LLMTask
): Promise<LLMResponse> {
  const client = getGroqClient();
  if (!client) throw new Error('GROQ_API_KEY not configured');

  const model = MODELS.groq[task];
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const text = response.choices[0]?.message?.content || '';

  return {
    text,
    provider: 'groq',
    model,
    tokens: response.usage?.completion_tokens,
  };
}

// ═══ FAILOVER ENGINE ═══

const PROVIDER_ORDER: LLMProvider[] = ['groq', 'gemini', 'claude'];

export async function callLLM(
  messages: LLMMessage[],
  options?: LLMCallOptions
): Promise<LLMResponse> {
  const maxTokens = options?.maxTokens ?? 1024;
  const task: LLMTask = options?.task ?? 'heavy';
  const cacheSystemPrompt = options?.cacheSystemPrompt ?? true;

  const order = options?.preferredProvider
    ? [options.preferredProvider, ...PROVIDER_ORDER.filter(p => p !== options.preferredProvider)]
    : options?.fallbackOrder || PROVIDER_ORDER;

  const errors: string[] = [];

  for (const provider of order) {
    try {
      switch (provider) {
        case 'claude':
          return await callClaude(messages, maxTokens, task, cacheSystemPrompt);
        case 'gemini':
          return await callGemini(messages, maxTokens, task);
        case 'groq':
          return await callGroq(messages, maxTokens, task);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg}`);
      console.warn(`[LLM] ${provider} (${task}) failed: ${msg}`);
      continue;
    }
  }

  throw new Error(`All LLM providers failed: ${errors.join(' | ')}`);
}

// ═══ AVAILABLE PROVIDERS CHECK ═══

export function getAvailableProviders(): LLMProvider[] {
  const available: LLMProvider[] = [];
  if (process.env.GROQ_API_KEY) available.push('groq');
  if (process.env.GEMINI_API_KEY) available.push('gemini');
  if (process.env.ANTHROPIC_API_KEY) available.push('claude');
  return available;
}
