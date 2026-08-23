import { Request, Response } from 'express';
import { chatWithOllama, ChatMessage } from '../services/OllamaService';
import { EventRepository } from '../database/repositories/EventRepository';
import { EventType } from '@shared/types/event';
import { ApiResponse } from '@shared/types/api';

const VISITOR_SYSTEM_PROMPT = `Você é o assistente virtual de uma campainha inteligente residencial.
Um visitante não reconhecido está falando com você pelo interfone.
Seja breve, educado e prestativo - no máximo 2 frases curtas por resposta.
Descubra o motivo da visita e ofereça para registrar um recado para o morador.
Nunca informe se há alguém em casa ou não. Responda sempre em português do Brasil.`;

export class AssistantController {
  private eventRepo: EventRepository;

  constructor() {
    this.eventRepo = new EventRepository();
  }

  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { messages } = req.body as { messages: ChatMessage[] };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ success: false, error: 'messages array is required' } as ApiResponse);
        return;
      }

      const reply = await chatWithOllama([{ role: 'system', content: VISITOR_SYSTEM_PROMPT }, ...messages]);

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
não reconhecida(s)${stats.lastUnrecognizedAt ? `, a última às ${stats.lastUnrecognizedAt}` : ''}.
Se os dois números forem zero, apenas dê boas-vindas.`,
          },
        ]);
      } catch {
        // Fall back to a plain templated sentence if the LLM call fails -
        // the resident should still hear something useful.
        text =
          stats.messagesCount === 0 && stats.unrecognizedVisitsCount === 0
            ? 'Nenhuma novidade nas últimas 24 horas.'
            : `Você tem ${stats.messagesCount} mensagem${stats.messagesCount === 1 ? '' : 's'} e ${stats.unrecognizedVisitsCount} visita${stats.unrecognizedVisitsCount === 1 ? '' : 's'} não reconhecida${stats.unrecognizedVisitsCount === 1 ? '' : 's'} nas últimas 24 horas.`;
      }

      res.json({ success: true, data: { text, stats } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
