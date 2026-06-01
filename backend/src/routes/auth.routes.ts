import { Router } from 'express';
import { body } from 'express-validator';
import { login, register, me, changePassword } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validate.middleware';

export const authRouter = Router();

authRouter.post('/login', authLimiter, validate([
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').isString().isLength({ min: 1 }).withMessage('Contraseña requerida'),
]), login);

authRouter.post('/register', authLimiter, validate([
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').isString().isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('nombre_completo').optional().isString().trim().isLength({ max: 120 }),
]), register);

authRouter.get('/me', authMiddleware, me);
authRouter.post('/change-password', authMiddleware, validate([
  body('passwordActual').isString().isLength({ min: 1 }).withMessage('Contraseña actual requerida'),
  body('passwordNueva').isString().isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
]), changePassword);
