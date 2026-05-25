import { Router } from 'express';
import { getBackups, createManualBackup, downloadBackup } from '../controllers/backups.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const backupsRouter = Router();

backupsRouter.use(authMiddleware, adminOnly);

backupsRouter.get('/', getBackups);
backupsRouter.post('/manual', createManualBackup);
backupsRouter.get('/:archivo/descargar', downloadBackup);
