import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventRepository } from '../database/repositories/EventRepository';
import { VisitsRepository } from '../database/repositories/VisitsRepository';
import { EventType } from '@shared/types/event';
import { ApiResponse } from '@shared/types/api';

function base64ToBuffer(base64: string): Buffer {
  const commaIndex = base64.indexOf(',');
  const data = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
  return Buffer.from(data, 'base64');
}

export class VisitorController {
  private eventRepo: EventRepository;
  private visitsRepo: VisitsRepository;

  constructor() {
    this.eventRepo = new EventRepository();
    this.visitsRepo = new VisitsRepository();
  }

  async recordUnrecognized(req: Request, res: Response): Promise<void> {
    try {
      const { videoBase64, photoBase64, doorbellId } = req.body;

      if (!videoBase64) {
        res.status(400).json({
          success: false,
          error: 'videoBase64 is required'
        } as ApiResponse);
        return;
      }

      const videosPath = process.env.VIDEOS_PATH || './data/storage/videos';
      const videoFile = `${Date.now()}-${crypto.randomUUID()}.webm`;
      fs.writeFileSync(path.join(videosPath, videoFile), base64ToBuffer(videoBase64));

      let photoFile: string | null = null;
      if (photoBase64 && typeof photoBase64 === 'string') {
        const photosPath = process.env.PHOTOS_PATH || './data/storage/photos';
        photoFile = `visit-${Date.now()}-${crypto.randomUUID()}.jpg`;
        fs.writeFileSync(path.join(photosPath, photoFile), base64ToBuffer(photoBase64));
      }

      const dbId = Number(doorbellId) || undefined;
      const event = this.eventRepo.create({
        type: EventType.PERSON_DETECTED,
        metadata: {
          recognized: false,
          videoFile,
          ...(photoFile ? { photoFile } : {}),
          ...(dbId ? { doorbellId: dbId } : {}),
        }
      });

      this.visitsRepo.create({
        visitor_id: null,
        photo_path: photoFile,
        event_id: event.id,
        doorbell_id: dbId ?? null,
        name_snapshot: 'Desconhecido',
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
