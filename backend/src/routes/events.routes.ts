import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { sseHandler } from '../controllers/events.controller';

export const eventsRouter = Router();
eventsRouter.get('/', authMiddleware, sseHandler);
