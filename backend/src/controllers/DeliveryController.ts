import { Request, Response } from 'express';
import { DeliveryRepository } from '../database/repositories/DeliveryRepository';
import { EventRepository } from '../database/repositories/EventRepository';
import { CreateDeliveryDTO } from '@shared/types/delivery';
import { EventType, EventStatus } from '@shared/types/event';
import { ApiResponse, PaginatedResponse } from '@shared/types/api';

export class DeliveryController {
  private deliveryRepo: DeliveryRepository;
  private eventRepo: EventRepository;

  constructor() {
    this.deliveryRepo = new DeliveryRepository();
    this.eventRepo = new EventRepository();
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateDeliveryDTO = req.body;

      // Validate
      if (!data.company) {
        res.status(400).json({
          success: false,
          error: 'Company is required'
        } as ApiResponse);
        return;
      }

      // If no event_id provided, create a new event
      if (!data.event_id) {
        const event = this.eventRepo.create({
          type: EventType.DELIVERY_SELECTED,
          metadata: { company: data.company }
        });
        data.event_id = event.id;
      }

      const delivery = this.deliveryRepo.create(data);

      // Update event status
      this.eventRepo.update(data.event_id, {
        status: EventStatus.COMPLETED
      });

      res.status(201).json({
        success: true,
        data: delivery
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

      const deliveries = this.deliveryRepo.findAll(pageSize, offset);
      const total = this.deliveryRepo.count();

      const response: PaginatedResponse<any> = {
        items: deliveries,
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
      const delivery = this.deliveryRepo.findById(id);

      if (!delivery) {
        res.status(404).json({
          success: false,
          error: 'Delivery not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: delivery
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }
}
