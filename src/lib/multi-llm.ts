// ═══ MULTI-LLM CLIENT — Failover entre Claude, Gemini, Groq (Llama/Grok) ═══

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export type LLMProvider = 'claude' | 'gemini' | 'groq';

interface LLMResponse {
  text: string;
  provider: LLMProvider;
  model: string;
  tokens?: number;
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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

async function callClaude(messages: LLMMessage[], maxTokens = 1024): Promise<LLMResponse> {
  const client = getClaudeClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured');

  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMsgs = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemMsg,
    messages: chatMsgs,
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    text,
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    tokens: response.usage?.output_tokens,
  };
}

async function callGemini(messages: LLMMessage[], maxTokens = 1024): Promise<LLMResponse> {
  const client = getGeminiClient();
  if (!client) throw new Error('GEMINI_API_KEY not configured');

  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
    model: 'gemini-2.0-flash',
  };
}

async function callGroq(messages: LLMMessage[], maxTokens = 1024): Promise<LLMResponse> {
  const client = getGroqClient();
  if (!client) throw new Error('GROQ_API_KEY not configured');

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
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
    model: 'llama-3.3-70b-versatile',
    tokens: response.usage?.completion_tokens,
  };
}

// ═══ FAILOVER ENGINE ═══

const PROVIDER_ORDER: LLMProvider[] = ['groq', 'gemini', 'claude'];

export async function callLLM(
  messages: LLMMessage[],
  options?: {
    maxTokens?: number;
    preferredProvider?: LLMProvider;
    fallbackOrder?: LLMProvider[];
  }
): Promise<LLMResponse> {
  const maxTokens = options?.maxTokens || 1024;
  const order = options?.preferredProvider
    ? [options.preferredProvider, ...PROVIDER_ORDER.filter(p => p !== options.preferredProvider)]
    : options?.fallbackOrder || PROVIDER_ORDER;

  const errors: string[] = [];

  for (const provider of order) {
    try {
      switch (provider) {
        case 'claude':
          return await callClaude(messages, maxTokens);
        case 'gemini':
          return await callGemini(messages, maxTokens);
        case 'groq':
          return await callGroq(messages, maxTokens);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg}`);
      console.warn(`[LLM] ${provider} failed: ${msg}`);
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
