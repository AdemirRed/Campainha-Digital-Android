import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventRepository } from '../database/repositories/EventRepository';
import { EventType } from '@shared/types/event';
import { ApiResponse } from '@shared/types/api';

function base64ToBuffer(base64: string): Buffer {
  const commaIndex = base64.indexOf(',');
  const data = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
  return Buffer.from(data, 'base64');
}

export class MessageController {
  private eventRepo: EventRepository;

  constructor() {
    this.eventRepo = new EventRepository();
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { text, audioBase64 } = req.body;

      if (!text && !audioBase64) {
        res.status(400).json({
          success: false,
          error: 'text or audioBase64 is required'
        } as ApiResponse);
        return;
      }

      let audioFile: string | null = null;

      if (audioBase64) {
        const audiosPath = process.env.AUDIOS_PATH || './data/storage/audios';
        audioFile = `${Date.now()}-${crypto.randomUUID()}.webm`;
        fs.writeFileSync(path.join(audiosPath, audioFile), base64ToBuffer(audioBase64));
      }

      const event = this.eventRepo.create({
        type: EventType.BUTTON_PRESSED,
        metadata: {
          reason: 'other',
          message: text || null,
          audioFile,
          doorbellId: Number(req.body.doorbellId) || undefined
        }
      });

      res.status(201).json({
        success: true,
        data: event
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }
}
