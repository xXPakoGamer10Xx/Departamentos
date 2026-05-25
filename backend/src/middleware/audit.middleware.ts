import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware que registra automáticamente cada acción en la tabla auditoria.
 * Se usa DESPUÉS de controllers que modifiquen datos.
 */
export function auditLog(tabla: string, accion: 'crear' | 'editar' | 'eliminar') {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    // Adjuntar función de auditoría al request para que el controller la llame
    (req as any).audit = async (registroId: string, datosPrevios?: object, datosNuevos?: object) => {
      try {
        await pool.query(
          `INSERT INTO auditoria (usuario_id, tabla_afectada, accion, registro_id, datos_anteriores, datos_nuevos, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user?.id || null,
            tabla,
            accion,
            registroId,
            datosPrevios ? JSON.stringify(datosPrevios) : null,
            datosNuevos ? JSON.stringify(datosNuevos) : null,
            req.ip || req.socket?.remoteAddress || null,
          ]
        );
      } catch (err) {
        console.error('Error en auditoría:', err);
        // No interrumpir el flujo por un error de auditoría
      }
    };
    next();
  };
}
