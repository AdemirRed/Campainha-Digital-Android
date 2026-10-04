import { logger } from '../utils/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatWithOllama(messages: ChatMessage[]): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
  const apiKey = process.env.OLLAMA_API_KEY || '';
  const model = process.env.OLLAMA_MODEL || 'llama3';
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(baseUrl);
  if (!apiKey && !isLocal) {
    throw new Error('OLLAMA_API_KEY not configured');
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    logger.error(`Ollama request failed: ${response.status}`);
    throw new Error(`Ollama request failed (${response.status})`);
  }

  const data: any = await response.json();
  const content = data?.message?.content;

  if (!content) {
    throw new Error('Ollama returned no content');
  }

  return content.trim();
}
