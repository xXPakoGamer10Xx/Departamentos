import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { createAndSendNotification } from '../services/push.service';
import { recalcularPago } from '../services/saldo.service';

function getCurrentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// GET /api/cuotas?inquilino_id=X
export async function getCuotas(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id, estado } = req.query;

    let where = 'WHERE i.admin_id = $1';
    const params: any[] = [req.user!.id];
    let idx = 2;

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
       JOIN inquilinos i ON i.id = c.inquilino_id
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

    const inqCheck = await pool.query(
      `SELECT id, usuario_id, depto_numero FROM inquilinos WHERE id = $1 AND admin_id = $2`,
      [inquilino_id, req.user!.id]
    );
    if (!inqCheck.rows[0]) throw new AppError('Inquilino no encontrado o no autorizado', 403);
    const inquilino = inqCheck.rows[0];

    const periodo = getCurrentPeriodo();
    const result = await pool.query(
      `INSERT INTO cuotas_extra (inquilino_id, concepto, monto, periodo, creado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [inquilino_id, concepto.trim(), Number(monto), periodo, req.user!.id]
    );

    // Si ya existe un registro de pago (sin confirmar) para este periodo, sumarle
    // el cargo — si no, el monto guardado queda desactualizado y los abonos
    // posteriores restan contra un total que no incluye este cargo.
    const pagoRes = await pool.query(
      `UPDATE pagos SET monto = monto + $1 WHERE inquilino_id = $2 AND periodo = $3 AND confirmado = false RETURNING id`,
      [Number(monto), inquilino_id, periodo]
    );
    if (pagoRes.rows[0]) {
      await recalcularPago(pagoRes.rows[0].id);
    }

    // Enviar notificación al inquilino si está vinculado
    if (inquilino.usuario_id) {
      const formattedMonto = Number(monto).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      await createAndSendNotification(
        inquilino.usuario_id,
        '🔔 Nuevo cargo adicional',
        `Se ha generado un cobro extra de ${formattedMonto} por: ${concepto.trim()}`,
        'cuota'
      );
    }

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
      `DELETE FROM cuotas_extra c
       USING inquilinos i
       WHERE c.id = $1 AND c.inquilino_id = i.id AND i.admin_id = $2 AND c.estado = 'pendiente'
       RETURNING c.id, c.inquilino_id, c.periodo, c.monto`,
      [id, req.user!.id]
    );
    if (!result.rows[0]) throw new AppError('Cuota no encontrada o ya fue pagada', 404);
    const cuota = result.rows[0];

    // Reflejar la baja del cargo en el pago del periodo, si aún no está confirmado.
    const pagoRes = await pool.query(
      `UPDATE pagos SET monto = GREATEST(monto - $1, 0) WHERE inquilino_id = $2 AND periodo = $3 AND confirmado = false RETURNING id`,
      [Number(cuota.monto), cuota.inquilino_id, cuota.periodo]
    );
    if (pagoRes.rows[0]) {
      await recalcularPago(pagoRes.rows[0].id);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
