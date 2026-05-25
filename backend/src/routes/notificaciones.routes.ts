import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getNotificaciones,
  marcarTodasComoLeidas,
  marcarComoLeida
} from '../controllers/notificaciones.controller';

export const notificacionesRouter = Router();

notificacionesRouter.get('/', authMiddleware, getNotificaciones);
notificacionesRouter.put('/marcar-leidas', authMiddleware, marcarTodasComoLeidas);
notificacionesRouter.put('/:id/leida', authMiddleware, marcarComoLeida);
