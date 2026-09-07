import { Request, Response } from 'express';
import { chatWithOllama, ChatMessage } from '../services/OllamaService';
import { transcribeAudio } from '../services/TranscriptionService';
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

const BASE_VISITOR_PROMPT = `Você atende a campainha de uma casa. Fale como um morador simpático
atenderia o interfone - gente boa, de boa, à vontade. Nada de tom de call center.

Como conversar:
- Português do Brasil, informal e caloroso. Pode usar "oi", "opa", "beleza", "claro", "tranquilo",
  "pode deixar", "já já", "valeu". Use contrações naturais (tá, pra, cê, tô).
- Respostas curtas, de 1 a 3 frases. Conversa de porta é rápida.
- Reaja ao que a pessoa diz antes de já querer resolver. Se ela cumprimentar, cumprimente de volta.
  Se disser algo engraçado, pode rir junto ("kkk", "haha"). Demonstre que entendeu ("ah, saquei",
  "entendi", "certo").
- Uma pergunta de cada vez. Não despeje um monte de perguntas juntas.
- Se a fala vier confusa ou cortada (a pessoa fala por microfone), peça pra repetir com naturalidade
  ("desculpa, não peguei bem, pode falar de novo?").
- Não invente nome do morador nem dados que você não tem. Não prometa horários exatos.

O que resolver:
- Descubra o motivo da visita e ajude: entrega, prestador de serviço, visita, vizinho.
- Se for entrega e a pessoa disser a empresa (Mercado Livre, Shopee, iFood, Correios, Amazon...),
  responda de forma específica e útil, não genérica.
- Sempre ofereça anotar um recado pro morador, do jeito mais leve possível
  ("quer que eu deixe um recado pra ele?").

Limites (importante):
- NÃO existe WhatsApp, SMS, e-mail nem app de mensagem. Nunca diga que vai "avisar no zap",
  "mandar mensagem", "ligar agora", "notificar". O que existe de verdade: o recado fica salvo e
  o morador vê no painel quando quiser - ou você mesmo conta pra ele quando ele chegar e perguntar
  se tem recado. Diga isso com suas palavras, sem soar robótico.`;

const PRESENCE_STALE_HOURS = 12;

const DELIVERY_COMPANY_LABELS: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  ifood: 'iFood',
  shopee: 'Shopee',
  correios: 'Correios',
  amazon: 'Amazon',
};

// Feeds the resident's pre-registered delivery confirmation codes (the
// number iFood / Mercado Livre couriers ask for) into the conversation.
function buildDeliveryCodesInstruction(raw: string | null): string {
  if (!raw) return '';
  let codes: { company?: string; code?: string; note?: string }[];
  try {
    codes = JSON.parse(raw);
  } catch {
    return '';
  }
  if (!Array.isArray(codes) || codes.length === 0) return '';

  const lines = codes
    .filter((c) => c && c.company && c.code)
    .map((c) => {
      const label = DELIVERY_COMPANY_LABELS[c.company as string] || c.company;
      return `- ${label}: código ${c.code}${c.note ? ` (${c.note})` : ''}`;
    });
  if (lines.length === 0) return '';

  return `O morador deixou códigos de confirmação de entrega cadastrados:
${lines.join('\n')}
Se o visitante disser que é entregador de uma dessas empresas e pedir/precisar do código de
confirmação, passe o código correspondente com naturalidade ("o código é X, pode confirmar aí").
Não invente código para empresas que não estão na lista - nesse caso, ofereça registrar um recado.`;
}

function buildPresenceInstruction(presenceRaw: string | null): string {
  if (!presenceRaw) {
    return 'Se perguntarem se há alguém em casa, diga que não tem certeza no momento.';
  }
  try {
    const presence = JSON.parse(presenceRaw) as { text: string; updatedAt: string };
    const ageMs = Date.now() - new Date(presence.updatedAt).getTime();
    if (ageMs > PRESENCE_STALE_HOURS * 60 * 60 * 1000) {
      return 'Se perguntarem se há alguém em casa, diga que não tem certeza no momento (a última atualização de status é antiga demais para confiar).';
    }
    return `O morador deixou este status sobre presença em casa: "${presence.text}". Se o
visitante perguntar se há alguém em casa, use esse status para responder (parafraseando, não
citando literalmente). Se o status não deixar claro, diga que não tem certeza.`;
  } catch {
    return 'Se perguntarem se há alguém em casa, diga que não tem certeza no momento.';
  }
}

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
      const presenceInstruction = buildPresenceInstruction(this.settingsRepo.get('presence_status'));
      const deliveryCodesInstruction = buildDeliveryCodesInstruction(this.settingsRepo.get('delivery_codes'));

      const systemPrompt = [
        BASE_VISITOR_PROMPT,
        presenceInstruction,
        deliveryCodesInstruction,
        customInstructions ? `Instruções do morador para você seguir:\n${customInstructions}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const reply = await chatWithOllama([{ role: 'system', content: systemPrompt }, ...messages]);

      res.json({ success: true, data: { reply } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  // Speech-to-text for the kiosk WebView, which has no Web Speech API.
  async transcribe(req: Request, res: Response): Promise<void> {
    try {
      const { audioBase64 } = req.body as { audioBase64?: string };
      if (!audioBase64) {
        res.status(400).json({ success: false, error: 'audioBase64 is required' } as ApiResponse);
        return;
      }
      const text = await transcribeAudio(audioBase64);
      res.json({ success: true, data: { text } } as ApiResponse);
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
      // The actual message texts, oldest first, so the resident can ask
      // to hear them read aloud instead of just being told a count.
      const messageTexts = messages
        .filter((e) => e.metadata?.message)
        .map((e) => e.metadata!.message as string)
        .reverse();
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

      res.json({ success: true, data: { text, stats, messages: messageTexts } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
