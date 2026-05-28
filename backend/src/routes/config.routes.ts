import { Router } from 'express';
import {
  getConfig, updateConfig, deleteContratoTemplate,
  procesarContratoIA, previewContratoPdf, descargarContratoDocx,
} from '../controllers/config.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const configRouter = Router();

configRouter.use(authMiddleware);

configRouter.get('/',                             getConfig);
configRouter.put('/',          adminOnly,         updateConfig);
configRouter.delete('/contrato-template',  adminOnly, deleteContratoTemplate);
configRouter.post('/contrato-procesar-ia', adminOnly, procesarContratoIA);
configRouter.post('/contrato-preview-pdf', adminOnly, previewContratoPdf);
configRouter.post('/contrato-descargar-docx', adminOnly, descargarContratoDocx);
