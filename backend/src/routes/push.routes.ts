import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { savePushToken } from '../controllers/push.controller';

export const pushRouter = Router();
pushRouter.post('/token', authMiddleware, savePushToken);
