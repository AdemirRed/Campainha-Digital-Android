import { Request, Response } from 'express';
import { SettingsRepository } from '../database/repositories/SettingsRepository';
import { ApiResponse } from '@shared/types/api';

export class SettingsController {
  private settingsRepo: SettingsRepository;

  constructor() {
    this.settingsRepo = new SettingsRepository();
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const settings = this.settingsRepo.getAll();
      
      res.json({
        success: true,
        data: settings
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    try {
      const key = req.params.key;
      const value = this.settingsRepo.get(key);

      if (value === null) {
        res.status(404).json({
          success: false,
          error: 'Setting not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: { key, value }
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }

  async set(req: Request, res: Response): Promise<void> {
    try {
      const key = req.params.key;
      const { value } = req.body;

      if (value === undefined) {
        res.status(400).json({
          success: false,
          error: 'Value is required'
        } as ApiResponse);
        return;
      }

      this.settingsRepo.set(key, value);

      res.json({
        success: true,
        data: { key, value },
        message: 'Setting updated successfully'
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }
}
