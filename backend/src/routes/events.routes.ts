import { Router } from 'express';
import { sseAuth } from '../middleware/auth.middleware';
import { sseHandler } from '../controllers/events.controller';

export const eventsRouter = Router();
eventsRouter.get('/', sseAuth, sseHandler);
