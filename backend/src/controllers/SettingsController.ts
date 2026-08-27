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

      // A setting simply not having been configured yet (e.g. the resident
      // never recorded a presence status) is a normal state, not an
      // error - respond 200 with a null value instead of 404 so it
      // doesn't show up as a failed request for callers just checking.
      res.json({
        success: true,
        data: { key, value: value === null ? null : value }
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
