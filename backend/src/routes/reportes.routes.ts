import { Router } from 'express';
import { getReporteAnual, getReporteMensual } from '../controllers/reportes.controller';
import { authMiddleware, requirePermiso } from '../middleware/auth.middleware';

export const reportesRouter = Router();

reportesRouter.use(authMiddleware, requirePermiso('reportes'));

reportesRouter.get('/anual', getReporteAnual);
reportesRouter.get('/mensual', getReporteMensual);
