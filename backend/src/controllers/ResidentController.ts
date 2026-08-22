import { Request, Response } from 'express';
import { ResidentRepository } from '../database/repositories/ResidentRepository';
import { CreateResidentDTO, UpdateResidentDTO } from '@shared/types/resident';
import { ApiResponse } from '@shared/types/api';

function isValidDescriptors(descriptors: any): descriptors is number[][] {
  if (!Array.isArray(descriptors) || descriptors.length === 0) return false;
  return descriptors.every(
    (d) => Array.isArray(d) && d.length === 128 && d.every((n) => typeof n === 'number')
  );
}

export class ResidentController {
  private residentRepo: ResidentRepository;

  constructor() {
    this.residentRepo = new ResidentRepository();
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateResidentDTO = req.body;

      if (!data.name) {
        res.status(400).json({
          success: false,
          error: 'Name is required'
        } as ApiResponse);
        return;
      }

      if (!isValidDescriptors(data.descriptors)) {
        res.status(400).json({
          success: false,
          error: 'descriptors must be a non-empty array of 128-length number arrays'
        } as ApiResponse);
        return;
      }

      const resident = this.residentRepo.create(data);

      res.status(201).json({
        success: true,
        data: resident
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
      const residents = this.residentRepo.findAll();

      res.json({
        success: true,
        data: residents
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
      const resident = this.residentRepo.findById(id);

      if (!resident) {
        res.status(404).json({
          success: false,
          error: 'Resident not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: resident
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
      const data: UpdateResidentDTO = req.body;

      if (data.descriptors !== undefined && !isValidDescriptors(data.descriptors)) {
        res.status(400).json({
          success: false,
          error: 'descriptors must be a non-empty array of 128-length number arrays'
        } as ApiResponse);
        return;
      }

      const resident = this.residentRepo.update(id, data);

      if (!resident) {
        res.status(404).json({
          success: false,
          error: 'Resident not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: resident
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
      this.residentRepo.delete(id);

      res.json({
        success: true,
        message: 'Resident deleted successfully'
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }
}
