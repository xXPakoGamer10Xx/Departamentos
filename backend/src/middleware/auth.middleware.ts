import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    rol: 'admin' | 'inquilino';
    nombre_completo: string;
  };
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;

  const raw = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;
  if (!raw) {
    return next(new AppError('Token de autenticación requerido', 401));
  }

  try {
    const decoded = jwt.verify(raw, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch {
    next(new AppError('Token inválido o expirado', 401));
  }
}

export function adminOnly(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.rol !== 'admin') {
    return next(new AppError('Acceso restringido a administradores', 403));
  }
  next();
}
