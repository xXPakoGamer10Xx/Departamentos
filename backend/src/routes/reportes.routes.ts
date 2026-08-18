import { Router } from 'express';
import { getReporteAnual } from '../controllers/reportes.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const reportesRouter = Router();

reportesRouter.use(authMiddleware, adminOnly);

reportesRouter.get('/anual', getReporteAnual);
