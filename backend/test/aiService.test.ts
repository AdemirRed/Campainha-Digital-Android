import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const messages = [
  { role: 'system' as const, content: 'Responda em português.' },
  { role: 'user' as const, content: 'Olá' },
];

describe('AI provider fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubEnv('OLLAMA_API_KEY', 'test-ollama-key');
    vi.stubEnv('OLLAMA_BASE_URL', 'https://ollama.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses OpenAI first when it returns text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Oi, tudo bem?' }] }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { chatWithAI } = await import('../src/services/AIService');
    expect(await chatWithAI(messages)).toBe('Oi, tudo bem?');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');
  });

  it('uses Ollama when OpenAI reports depleted quota', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'insufficient_quota' } }), { status: 429 }))
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ message: { content: 'Posso anotar seu recado.' } }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    const { chatWithAI } = await import('../src/services/AIService');
    expect(await chatWithAI(messages)).toBe('Posso anotar seu recado.');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'https://api.openai.com/v1/responses',
      'https://ollama.com/api/chat',
    ]);
    await chatWithAI(messages);
    expect(fetchMock.mock.calls[2][0]).toBe('https://ollama.com/api/chat');
  });
});
