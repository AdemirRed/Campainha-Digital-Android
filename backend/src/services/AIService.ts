import { logger } from '../utils/logger';
import { ChatMessage, chatWithOllama } from './OllamaService';
import { chatWithOpenAI, OpenAIServiceError } from './OpenAIService';

let openAIDisabledUntil = 0;

export async function chatWithAI(messages: ChatMessage[], maxOutputTokens = 180): Promise<string> {
  if (process.env.OPENAI_API_KEY?.trim() && Date.now() >= openAIDisabledUntil) {
    try {
      return await chatWithOpenAI(messages, maxOutputTokens);
    } catch (error) {
      if (error instanceof OpenAIServiceError && error.code === 'insufficient_quota') {
        // Avoid charging latency to every visitor after credits run out.
        openAIDisabledUntil = Date.now() + 5 * 60_000;
      }
      logger.warn(`OpenAI unavailable; switching to Ollama (${error instanceof Error ? error.message : 'unknown error'})`);
    }
  }

  return chatWithOllama(messages);
}
