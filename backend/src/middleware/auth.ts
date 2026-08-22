import { Request, Response, NextFunction } from 'express';

export function auth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  // Simple token validation for MVP
  // TODO: Replace with JWT in Phase 4
  if (token !== process.env.API_TOKEN) {
    res.status(403).json({
      success: false,
      error: 'Invalid token'
    });
    return;
  }

  next();
}
