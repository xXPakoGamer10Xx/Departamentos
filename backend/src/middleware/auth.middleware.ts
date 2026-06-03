import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    rol: 'admin' | 'inquilino' | 'cobrador';
    nombre_completo: string;
  };
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  // Solo se acepta el token vía header Authorization. El token por query string
  // (?token=) queda restringido a las rutas públicas de QR que usan softAuth,
  // para evitar fugas de token en logs, referers e historial del navegador.
  const authHeader = req.headers.authorization;

  const raw = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
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

export function cobradorOrAdmin(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.rol !== 'admin' && req.user?.rol !== 'cobrador') {
    return next(new AppError('Acceso restringido a administradores y cobradores', 403));
  }
  next();
}

// Para rutas que el browser abre directamente (PDF): acepta token en header O en ?token=
export function pdfAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;
  const raw = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;
  if (!raw) return next(new AppError('Token de autenticación requerido', 401));
  try {
    req.user = jwt.verify(raw, process.env.JWT_SECRET!) as any;
    next();
  } catch {
    next(new AppError('Token inválido o expirado', 401));
  }
}

export function softAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;
  const raw = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;
  if (!raw) return next();
  try {
    req.user = jwt.verify(raw, process.env.JWT_SECRET!) as any;
  } catch { /* token inválido, continuar anónimo */ }
  next();
}
