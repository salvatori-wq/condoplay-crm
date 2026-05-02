import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dos SDKs antes de importar o módulo
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'ok-gemini' } }) };
    }
  },
}));
vi.mock('groq-sdk', () => ({
  default: class {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'ok-groq' } }],
          usage: { completion_tokens: 3 },
        }),
      },
    };
  },
}));

describe('callLLM', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'g-test';
    process.env.GROQ_API_KEY = 'gq-test';
  });
  afterEach(() => {
    vi.resetModules();
  });

  it('escolhe Haiku quando task=light', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok-haiku' }],
      usage: { output_tokens: 5, cache_read_input_tokens: 0 },
    });
    const { callLLM } = await import('./multi-llm');
    const res = await callLLM([{ role: 'user', content: 'oi' }], {
      task: 'light',
      preferredProvider: 'claude',
    });
    expect(res.model).toBe('claude-haiku-4-5-20251001');
    expect(res.provider).toBe('claude');
  });

  it('adiciona cache_control no system prompt quando cacheSystemPrompt=true', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { output_tokens: 5, cache_read_input_tokens: 100 },
    });
    const { callLLM } = await import('./multi-llm');
    const res = await callLLM(
      [
        { role: 'system', content: 'Prompt longo com várias instruções' },
        { role: 'user', content: 'pergunta' },
      ],
      { preferredProvider: 'claude', task: 'heavy' }
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(Array.isArray(call.system)).toBe(true);
    expect(call.system[0]).toMatchObject({
      type: 'text',
      cache_control: { type: 'ephemeral' },
    });
    expect(res.cacheHit).toBe(true);
  });

  it('NÃO adiciona cache_control quando cacheSystemPrompt=false', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { output_tokens: 5 },
    });
    const { callLLM } = await import('./multi-llm');
    await callLLM(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'u' },
      ],
      { preferredProvider: 'claude', cacheSystemPrompt: false }
    );
    const call = mockCreate.mock.calls[0][0];
    expect(typeof call.system).toBe('string');
  });

  it('failover: cai para gemini quando groq falha', async () => {
    const { callLLM } = await import('./multi-llm');
    // groq-sdk mock retorna ok por padrão; vamos forçar falha sobrescrevendo
    vi.doMock('groq-sdk', () => ({
      default: class {
        chat = {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('groq down')),
          },
        };
      },
    }));
    vi.resetModules();
    const { callLLM: callLLM2 } = await import('./multi-llm');
    const res = await callLLM2([{ role: 'user', content: 'oi' }]);
    // com groq down, deve ter caído para gemini (ou claude se gemini também falhar)
    expect(['gemini', 'claude']).toContain(res.provider);
  });
});
