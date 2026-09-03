import { Request, Response } from 'express';
import { DoorbellRepository } from '../database/repositories/DoorbellRepository';
import { parseId } from '../utils/params';
import { ApiResponse } from '@shared/types/api';

export class DoorbellController {
  private repo = new DoorbellRepository();

  list = (_req: Request, res: Response): void => {
    res.json({ success: true, data: this.repo.findAll() } as ApiResponse);
  };

  create = (req: Request, res: Response): void => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'Nome é obrigatório' } as ApiResponse);
      return;
    }
    res.status(201).json({ success: true, data: this.repo.create(name) } as ApiResponse);
  };

  rename = (req: Request, res: Response): void => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, error: 'ID inválido' } as ApiResponse);
      return;
    }
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'Nome é obrigatório' } as ApiResponse);
      return;
    }
    const updated = this.repo.rename(id, name);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Campainha não encontrada' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: updated } as ApiResponse);
  };

  remove = (req: Request, res: Response): void => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, error: 'ID inválido' } as ApiResponse);
      return;
    }
    const result = this.repo.delete(id);
    if (!result.ok) {
      const msg = result.reason === 'default' ? 'A campainha padrão não pode ser removida' : 'Deixe ao menos uma campainha';
      res.status(400).json({ success: false, error: msg } as ApiResponse);
      return;
    }
    res.json({ success: true, data: null } as ApiResponse);
  };
}
