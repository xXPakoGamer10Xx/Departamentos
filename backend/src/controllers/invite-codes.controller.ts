import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

/** Genera un código corto aleatorio del formato "XXXX-XXXX" */
function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O, 0, I, 1 para evitar confusión
  const parte = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${parte(4)}-${parte(4)}`;
}

/** Calcula la fecha de expiración según los días recibidos (null = indefinido) */
function calcularExpiracion(expira_dias: number | null): Date | null {
  if (expira_dias === null || expira_dias === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + expira_dias);
  return d;
}

// POST /api/invite-codes
export async function crearCodigo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rol = 'inquilino', expira_dias = null } = req.body;

    if (!['inquilino', 'cobrador'].includes(rol)) {
      throw new AppError('Rol inválido. Usa "inquilino" o "cobrador"', 400);
    }

    // Intentar generar un código único (máx. 10 intentos)
    let codigo = '';
    for (let i = 0; i < 10; i++) {
      const candidate = generarCodigo();
      const existing = await pool.query(
        `SELECT 1 FROM codigos_invitacion WHERE codigo = $1`, [candidate]
      );
      if (existing.rows.length === 0) { codigo = candidate; break; }
    }
    if (!codigo) throw new AppError('No se pudo generar un código único. Intenta de nuevo.', 500);

    const expiraEn = calcularExpiracion(expira_dias !== null ? Number(expira_dias) : null);

    const result = await pool.query(
      `INSERT INTO codigos_invitacion (admin_id, codigo, rol, expira_en)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user!.id, codigo, rol, expiraEn]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// GET /api/invite-codes
export async function listarCodigos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT ci.*,
              u.nombre_completo AS usado_por_nombre
       FROM codigos_invitacion ci
       LEFT JOIN usuarios u ON u.id = ci.usado_por
       WHERE ci.admin_id = $1
       ORDER BY ci.created_at DESC`,
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/invite-codes/:id
export async function revocarCodigo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM codigos_invitacion WHERE id = $1 AND admin_id = $2 RETURNING id`,
      [id, req.user!.id]
    );
    if (!result.rows[0]) throw new AppError('Código no encontrado', 404);
    res.json({ success: true, message: 'Código revocado' });
  } catch (err) {
    next(err);
  }
}
