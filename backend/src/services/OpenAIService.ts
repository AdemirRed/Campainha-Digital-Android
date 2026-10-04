import { ChatMessage } from './OllamaService';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

export class OpenAIServiceError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(`OpenAI request failed (${status}: ${code})`);
  }
}

export async function chatWithOpenAI(messages: ChatMessage[], maxOutputTokens = 180): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-6-luna',
      input: messages,
      max_output_tokens: maxOutputTokens,
      reasoning: { effort: 'none' },
      store: false,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
    throw new OpenAIServiceError(response.status, error.error?.code || error.error?.type || 'unknown');
  }

  const data = await response.json() as {
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  const content = data.output
    ?.filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text || '')
    .join('\n')
    .trim();

  if (!content) throw new Error('OpenAI returned no content');
  return content;
}
