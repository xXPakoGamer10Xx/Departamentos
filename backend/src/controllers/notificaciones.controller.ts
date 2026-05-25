import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

// GET /api/notificaciones
export async function getNotificaciones(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT * FROM notificaciones 
       WHERE usuario_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user!.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notificaciones/marcar-leidas
export async function marcarTodasComoLeidas(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await pool.query(
      `UPDATE notificaciones 
       SET leido = true 
       WHERE usuario_id = $1`,
      [req.user!.id]
    );

    res.json({ success: true, message: 'Todas las notificaciones fueron marcadas como leídas' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notificaciones/:id/leida
export async function marcarComoLeida(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const check = await pool.query(
      `SELECT id FROM notificaciones WHERE id = $1 AND usuario_id = $2`,
      [id, req.user!.id]
    );

    if (check.rows.length === 0) {
      throw new AppError('Notificación no encontrada o no pertenece al usuario', 404);
    }

    const result = await pool.query(
      `UPDATE notificaciones 
       SET leido = true 
       WHERE id = $1 AND usuario_id = $2 
       RETURNING *`,
      [id, req.user!.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
