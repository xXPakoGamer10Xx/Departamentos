import { Router } from 'express';
import {
  getMiDepto, getInquilinos, getInquilinoById, getContratoPdf,
  createInquilino, updateInquilino, deleteInquilino, vincularUsuario,
} from '../controllers/inquilinos.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';

export const inquilinosRouter = Router();

inquilinosRouter.use(authMiddleware);

// Must be before /:id to avoid being treated as an ID
inquilinosRouter.get('/mi-depto', getMiDepto);

inquilinosRouter.get('/', getInquilinos);
inquilinosRouter.get('/:id', getInquilinoById);
inquilinosRouter.get('/:id/pdf', getContratoPdf);
inquilinosRouter.post('/', adminOnly, auditLog('inquilinos', 'crear'), createInquilino);
inquilinosRouter.put('/:id', adminOnly, auditLog('inquilinos', 'editar'), updateInquilino);
inquilinosRouter.put('/:id/vincular-usuario', adminOnly, vincularUsuario);
inquilinosRouter.delete('/:id', adminOnly, auditLog('inquilinos', 'eliminar'), deleteInquilino);
