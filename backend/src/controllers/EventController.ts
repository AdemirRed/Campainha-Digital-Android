import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { EventRepository } from '../database/repositories/EventRepository';
import { EventService } from '../services/EventService';
import { CreateEventDTO, UpdateEventDTO } from '@shared/types/event';
import { ApiResponse, PaginatedResponse } from '@shared/types/api';

function unlinkIfExists(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort cleanup - a stray file isn't worth failing the delete over
  }
}

export class EventController {
  private eventRepo: EventRepository;
  private eventService: EventService;

  constructor() {
    this.eventRepo = new EventRepository();
    this.eventService = new EventService();
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateEventDTO = req.body;

      // Validate
      if (!data.type) {
        res.status(400).json({
          success: false,
          error: 'Event type is required'
        } as ApiResponse);
        return;
      }

      // Stamp which doorbell this event came from, when the kiosk sends it
      // (optional - resident-side callers omit it). The app nests it inside
      // metadata; older/other callers may send it top-level.
      const rawDoorbellId = data.metadata?.doorbellId ?? (req.body as any).doorbellId;
      const doorbellId = Number(rawDoorbellId);
      if (Number.isFinite(doorbellId) && doorbellId > 0) {
        data.metadata = { ...(data.metadata || {}), doorbellId };
      } else if (data.metadata && 'doorbellId' in data.metadata) {
        // incoming nested value was garbage - don't persist it
        delete (data.metadata as any).doorbellId;
      }

      const event = this.eventRepo.create(data);

      // Emit event to EventBus
      this.eventService.emitEvent(event.type, event);

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

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const offset = (page - 1) * pageSize;

      const events = this.eventRepo.findAll(pageSize, offset);
      const total = this.eventRepo.count();

      const response: PaginatedResponse<any> = {
        items: events,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };

      res.json({
        success: true,
        data: response
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const event = this.eventRepo.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        } as ApiResponse);
        return;
      }

      res.json({
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

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const data: UpdateEventDTO = req.body;

      const event = this.eventRepo.update(id, data);

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        } as ApiResponse);
        return;
      }

      res.json({
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

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const event = this.eventRepo.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        } as ApiResponse);
        return;
      }

      // An event's metadata may reference an uploaded file (audio message
      // or unrecognized-visitor clip) - remove it too, otherwise deleting
      // the event from the admin panel leaves an orphaned file on disk.
      if (event.metadata?.audioFile) {
        unlinkIfExists(path.join(process.env.AUDIOS_PATH || './data/storage/audios', event.metadata.audioFile));
      }
      if (event.metadata?.videoFile) {
        unlinkIfExists(path.join(process.env.VIDEOS_PATH || './data/storage/videos', event.metadata.videoFile));
      }

      this.eventRepo.delete(id);

      res.json({
        success: true,
        message: 'Event deleted successfully'
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }
}
