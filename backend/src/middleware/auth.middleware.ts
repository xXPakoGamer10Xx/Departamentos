import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';
import { pool } from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;              // OJO: para un colaborador se reescribe al id del admin dueño
    email: string;
    rol: 'admin' | 'inquilino' | 'cobrador';
    nombre_completo: string;
    admin_id?: string;       // admin dueño de los datos (para cobrador/inquilino)
    actorId?: string;        // el usuario real que hace la petición (colaborador)
    permisos?: string[];     // solo informativo; el gating real relee de la BD
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
    // Un colaborador (cobrador) opera SOBRE los datos de su admin: reescribimos
    // req.user.id al del admin para que todas las consultas `WHERE admin_id = id`
    // sigan funcionando sin tocar cada controlador. `actorId` guarda quién actúa.
    if (decoded.rol === 'cobrador' && decoded.admin_id) {
      req.user!.actorId = decoded.id;
      req.user!.id = decoded.admin_id;
    }
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

// Gating por permiso para colaboradores. El admin pasa siempre. Un 'cobrador'
// pasa si tiene ALGUNO de los permisos indicados (se leen frescos de la BD, así
// que cambiarlos surte efecto sin re-login). Cualquier otro rol: 403.
export function requirePermiso(...keys: string[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (req.user?.rol === 'admin') return next();
    if (req.user?.rol !== 'cobrador') {
      return next(new AppError('Acceso restringido', 403));
    }
    try {
      // req.user.id ya fue reescrito al admin; el colaborador real es actorId.
      const r = await pool.query(
        `SELECT permisos FROM usuarios WHERE id = $1 AND activo = TRUE`,
        [req.user.actorId ?? req.user.id]
      );
      const permisos: string[] = Array.isArray(r.rows[0]?.permisos) ? r.rows[0].permisos : [];
      if (keys.some(k => permisos.includes(k))) return next();
      next(new AppError('No tienes permiso para esta acción', 403));
    } catch (err) {
      next(err);
    }
  };
}

// Para rutas que el browser abre directamente (PDF): acepta token en header O en ?token=.
// No reutiliza el JWT de sesión — exige un token de un solo propósito (scope
// 'pdf_download', emitido por POST /:id/pdf-token) con expiración corta y
// atado a un inquilino específico, para no exponer credenciales de admin
// completas en la URL (historial de navegador, logs, referrers).
export function pdfAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;
  const raw = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;
  if (!raw) return next(new AppError('Token de autenticación requerido', 401));
  try {
    const decoded = jwt.verify(raw, process.env.JWT_SECRET!) as any;
    if (decoded.scope !== 'pdf_download' || decoded.inquilino_id !== req.params.id) {
      return next(new AppError('Token inválido para este recurso', 403));
    }
    req.user = { id: decoded.admin_id, rol: 'admin', email: '', nombre_completo: '' };
    next();
  } catch {
    next(new AppError('Token inválido o expirado', 401));
  }
}

// Para el stream de eventos en vivo (SSE): el EventSource nativo del navegador
// no puede mandar headers personalizados, así que el token viaja por query string
// igual que en pdfAuth. Acepta el JWT de sesión completo (no un token de un solo
// propósito) porque el stream solo lee, nunca muta datos.
export function sseAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;
  const raw = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;
  if (!raw) return next(new AppError('Token de autenticación requerido', 401));
  try {
    const decoded = jwt.verify(raw, process.env.JWT_SECRET!) as any;
    req.user = decoded;
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
