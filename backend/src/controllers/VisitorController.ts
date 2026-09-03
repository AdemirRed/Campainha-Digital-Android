import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventRepository } from '../database/repositories/EventRepository';
import { VisitsRepository } from '../database/repositories/VisitsRepository';
import { VisitorRepository } from '../database/repositories/VisitorRepository';
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

  list = (_req: Request, res: Response): void => {
    const rows = new VisitorRepository().findAll();
    res.json({ success: true, data: rows.map(({ descriptor, ...rest }) => rest) } as ApiResponse);
  };

  rename = (req: Request, res: Response): void => {
    const id = Number(req.params.id);
    const name = String(req.body?.name ?? '').trim();
    if (!name) { res.status(400).json({ success: false, error: 'name é obrigatório' } as ApiResponse); return; }
    const updated = new VisitorRepository().rename(id, name);
    if (!updated) { res.status(404).json({ success: false, error: 'Visitante não encontrado' } as ApiResponse); return; }
    res.json({ success: true, data: updated } as ApiResponse);
  };

  listVisits = (req: Request, res: Response): void => {
    const id = Number(req.params.id);
    const rows = new VisitsRepository().listByVisitor(id);
    res.json({ success: true, data: rows.map(({ descriptor, ...rest }) => rest) } as ApiResponse);
  };

  timeline = (req: Request, res: Response): void => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const doorbellId = req.query.doorbellId ? Number(req.query.doorbellId) : undefined;
    const result = new VisitsRepository().listTimeline(page, pageSize, doorbellId);
    res.json({
      success: true,
      data: { items: result.items.map(({ descriptor, ...rest }) => rest), total: result.total },
    } as ApiResponse);
  };

  nameVisit = (req: Request, res: Response): void => {
    const visitId = Number(req.params.id);
    const name = String(req.body?.name ?? '').trim();
    if (!name) { res.status(400).json({ success: false, error: 'name é obrigatório' } as ApiResponse); return; }
    const visitsRepo = new VisitsRepository();
    const visitorRepo = new VisitorRepository();
    const visit = visitsRepo.findById(visitId);
    if (!visit) { res.status(404).json({ success: false, error: 'Visita não encontrada' } as ApiResponse); return; }

    let visitorId = visit.visitor_id;
    if (!visitorId && (!visit.descriptor || visit.descriptor.length === 0)) {
      // Sem descriptor utilizável: não cria visitante (um descriptor vazio
      // envenena o reconhecimento facial). Só rotula a visita.
      visitsRepo.setName(visitId, name);
      res.json({ success: true, data: { visitorId: null } } as ApiResponse);
      return;
    }
    if (visitorId) {
      visitorRepo.rename(visitorId, name);
    } else {
      const created = visitorRepo.create({
        name,
        descriptor: visit.descriptor ?? [],
        photo_path: visit.photo_path ?? null,
        notes: null,
      });
      visitorId = created.id;
    }
    visitsRepo.attachVisitor(visitId, visitorId, name);
    // propaga o nome para outras visitas já vinculadas a esse visitante
    for (const v of visitsRepo.listByVisitor(visitorId)) {
      if (!v.name_snapshot || v.name_snapshot === 'Desconhecido') {
        visitsRepo.attachVisitor(v.id, visitorId, name);
      }
    }
    res.json({ success: true, data: { visitorId } } as ApiResponse);
  };
}
