import { logger } from '../utils/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const BASE_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
const API_KEY = process.env.OLLAMA_API_KEY || '';
const MODEL = process.env.OLLAMA_MODEL || 'llama3';

export async function chatWithOllama(messages: ChatMessage[]): Promise<string> {
  if (!API_KEY) {
    throw new Error('OLLAMA_API_KEY not configured');
  }

  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logger.error(`Ollama request failed: ${response.status} ${text}`);
    throw new Error(`Ollama request failed (${response.status})`);
  }

  const data: any = await response.json();
  const content = data?.message?.content;

  if (!content) {
    throw new Error('Ollama returned no content');
  }

  return content.trim();
}
