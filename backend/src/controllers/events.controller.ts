import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { addSSEClient, removeSSEClient } from '../services/sse.service';

export function sseHandler(req: AuthRequest, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const userId = req.user!.id;
  const rol = req.user!.rol;

  addSSEClient(userId, rol, res);
  res.write('event: connected\ndata: {}\n\n');

  const heartbeat = setInterval(() => {
    try { res.write(':ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSSEClient(userId, res);
  });
}
