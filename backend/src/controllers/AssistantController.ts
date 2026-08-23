import { Request, Response } from 'express';
import { chatWithOllama, ChatMessage } from '../services/OllamaService';
import { EventRepository } from '../database/repositories/EventRepository';
import { SettingsRepository } from '../database/repositories/SettingsRepository';
import { EventType } from '@shared/types/event';
import { ApiResponse } from '@shared/types/api';

const TIMEZONE = 'America/Sao_Paulo';

function formatLocalTime(sqliteTimestamp: string): string {
  // SQLite's CURRENT_TIMESTAMP is UTC with no offset marker - without
  // forcing the timezone here, the LLM (and anyone reading the raw
  // string) has no way to know it's not already local time.
  const date = new Date(sqliteTimestamp.replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const BASE_VISITOR_PROMPT = `Você é o assistente virtual de uma campainha inteligente residencial, com a
simpatia e o jeitinho de quem realmente mora ali - não uma central de atendimento genérica.
Um visitante está falando com você pelo interfone.
Seja breve, natural e prestativo - no máximo 2 frases curtas por resposta.
Descubra o motivo da visita e ajude com o que for preciso: entregadores, prestadores de serviço,
vizinhos, etc. Se souberem que tipo de entrega é (Mercado Livre, iFood, Correios...), responda de
forma útil e específica em vez de genérica.
Nunca confirme ou negue se há alguém em casa. Ofereça sempre registrar um recado para o morador.
Responda sempre em português do Brasil.`;

export class AssistantController {
  private eventRepo: EventRepository;
  private settingsRepo: SettingsRepository;

  constructor() {
    this.eventRepo = new EventRepository();
    this.settingsRepo = new SettingsRepository();
  }

  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { messages } = req.body as { messages: ChatMessage[] };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ success: false, error: 'messages array is required' } as ApiResponse);
        return;
      }

      // Residents can leave standing instructions (e.g. "se for entrega do
      // Mercado Livre, o código é 1234; peça para deixar na cadeira")
      // via the admin panel, applied to every conversation.
      const customInstructions = this.settingsRepo.get('assistant_instructions');
      const systemPrompt = customInstructions
        ? `${BASE_VISITOR_PROMPT}\n\nInstruções do morador para você seguir:\n${customInstructions}`
        : BASE_VISITOR_PROMPT;

      const reply = await chatWithOllama([{ role: 'system', content: systemPrompt }, ...messages]);

      res.json({ success: true, data: { reply } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  async summary(req: Request, res: Response): Promise<void> {
    try {
      const events = this.eventRepo.findAll(100, 0);
      const since = Date.now() - 24 * 60 * 60 * 1000;

      const recent = events.filter(
        (e) => new Date(e.created_at.replace(' ', 'T') + 'Z').getTime() >= since
      );

      const messages = recent.filter((e) => e.metadata?.reason === 'other');
      const unrecognizedVisits = recent.filter(
        (e) => e.type === EventType.PERSON_DETECTED && e.metadata?.recognized === false
      );
      const lastUnrecognized = unrecognizedVisits[0]; // findAll orders DESC by created_at

      const stats = {
        messagesCount: messages.length,
        unrecognizedVisitsCount: unrecognizedVisits.length,
        lastUnrecognizedAt: lastUnrecognized?.created_at || null,
      };
      const lastUnrecognizedLocalTime = lastUnrecognized ? formatLocalTime(lastUnrecognized.created_at) : null;

      let text: string;
      try {
        text = await chatWithOllama([
          {
            role: 'system',
            content: `Você é o assistente de uma campainha inteligente, dando um resumo curto e falado
(no máximo 2 frases) para o morador que acabou de chegar em casa, sobre o que aconteceu nas
últimas 24 horas. Responda só com o texto a ser falado, em português do Brasil, sem formatação.`,
          },
          {
            role: 'user',
            content: `Dados: ${stats.messagesCount} mensagem(ns) recebida(s), ${stats.unrecognizedVisitsCount} visita(s)
não reconhecida(s)${lastUnrecognizedLocalTime ? `, a última às ${lastUnrecognizedLocalTime} (horário de Brasília)` : ''}.
Se os dois números forem zero, apenas dê boas-vindas.`,
          },
        ]);
      } catch {
        // Fall back to a plain templated sentence if the LLM call fails -
        // the resident should still hear something useful.
        text =
          stats.messagesCount === 0 && stats.unrecognizedVisitsCount === 0
            ? 'Nenhuma novidade nas últimas 24 horas.'
            : `Você tem ${stats.messagesCount} ${stats.messagesCount === 1 ? 'mensagem' : 'mensagens'} e ${stats.unrecognizedVisitsCount} ${stats.unrecognizedVisitsCount === 1 ? 'visita não reconhecida' : 'visitas não reconhecidas'} nas últimas 24 horas.`;
      }

      res.json({ success: true, data: { text, stats } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
