import { Router } from 'express';
import { getConfig, updateConfig, deleteContratoTemplate } from '../controllers/config.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const configRouter = Router();

configRouter.use(authMiddleware);

configRouter.get('/', getConfig);
configRouter.put('/', adminOnly, updateConfig);
configRouter.delete('/contrato-template', adminOnly, deleteContratoTemplate);
