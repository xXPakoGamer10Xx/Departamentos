import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

function getCurrentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// GET /api/cuotas?inquilino_id=X
export async function getCuotas(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id, estado } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (inquilino_id) {
      where += ` AND c.inquilino_id = $${idx++}`;
      params.push(inquilino_id);
    }
    if (estado) {
      where += ` AND c.estado = $${idx++}`;
      params.push(estado);
    }

    const result = await pool.query(
      `SELECT c.*, u.nombre_completo as creado_por_nombre
       FROM cuotas_extra c
       LEFT JOIN usuarios u ON u.id = c.creado_por
       ${where}
       ORDER BY c.created_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/cuotas — admin crea cuota extra
export async function createCuota(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id, concepto, monto } = req.body;

    if (!inquilino_id || !concepto?.trim() || !monto) {
      throw new AppError('inquilino_id, concepto y monto son requeridos', 400);
    }
    if (Number(monto) <= 0) {
      throw new AppError('El monto debe ser mayor a cero', 400);
    }

    const inqCheck = await pool.query(`SELECT id FROM inquilinos WHERE id = $1`, [inquilino_id]);
    if (!inqCheck.rows[0]) throw new AppError('Inquilino no encontrado', 404);

    const periodo = getCurrentPeriodo();
    const result = await pool.query(
      `INSERT INTO cuotas_extra (inquilino_id, concepto, monto, periodo, creado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [inquilino_id, concepto.trim(), Number(monto), periodo, req.user!.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cuotas/:id — cancelar cuota pendiente
export async function deleteCuota(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM cuotas_extra WHERE id = $1 AND estado = 'pendiente' RETURNING id`,
      [id]
    );
    if (!result.rows[0]) throw new AppError('Cuota no encontrada o ya fue pagada', 404);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
