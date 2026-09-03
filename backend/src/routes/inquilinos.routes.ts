import { Router } from 'express';
import {
  getMiDepto, getInquilinos, getInquilinoById, getContratoPdf, generarTokenPdf,
  createInquilino, updateInquilino, deleteInquilino, vincularUsuario,
  extraerIne,
  getContratoEditable, guardarContratoInquilino, previewContratoInquilino,
} from '../controllers/inquilinos.controller';
import { authMiddleware, adminOnly, pdfAuth } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';

export const inquilinosRouter = Router();

// PDF se registra ANTES del authMiddleware global porque el browser lo abre
// directamente y no puede mandar headers — acepta token en ?token= también,
// pero solo el token de un solo propósito emitido por /:id/pdf-token (ver pdfAuth).
inquilinosRouter.get('/:id/pdf', pdfAuth, adminOnly, getContratoPdf);

inquilinosRouter.use(authMiddleware);

inquilinosRouter.post('/:id/pdf-token', adminOnly, generarTokenPdf);

// Editor de contrato por inquilino
inquilinosRouter.get('/:id/contrato-editable', adminOnly, getContratoEditable);
inquilinosRouter.put('/:id/contrato', adminOnly, auditLog('inquilinos', 'editar'), guardarContratoInquilino);
inquilinosRouter.post('/:id/contrato-preview', adminOnly, previewContratoInquilino);

// Must be before /:id to avoid being treated as an ID
inquilinosRouter.get('/mi-depto', getMiDepto);
inquilinosRouter.post('/extraer-ine', adminOnly, extraerIne);

inquilinosRouter.get('/', getInquilinos);
inquilinosRouter.get('/:id', getInquilinoById);
inquilinosRouter.post('/', adminOnly, auditLog('inquilinos', 'crear'), createInquilino);
inquilinosRouter.put('/:id', adminOnly, auditLog('inquilinos', 'editar'), updateInquilino);
inquilinosRouter.put('/:id/vincular-usuario', adminOnly, vincularUsuario);
inquilinosRouter.delete('/:id', adminOnly, auditLog('inquilinos', 'eliminar'), deleteInquilino);
