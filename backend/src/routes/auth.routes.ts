import { Router } from 'express';
import { login, register, me, changePassword } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/register', register);
authRouter.get('/me', authMiddleware, me);
authRouter.post('/change-password', authMiddleware, changePassword);
