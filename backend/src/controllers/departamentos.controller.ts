import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// GET /api/departamentos
export async function getDepartamentos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT d.*,
        (SELECT json_build_object(
          'id', i.id,
          'nombre', i.nombre_completo,
          'renta', i.renta,
          'fecha_termino', i.fecha_termino,
          'tel', i.tel_arrendatario,
          'estado', i.estado
        ) FROM inquilinos i WHERE i.admin_id = d.admin_id AND i.depto_numero = d.numero AND i.estado = 'activo'
        ORDER BY i.created_at DESC LIMIT 1) as inquilino_actual
      FROM departamentos d
      WHERE d.admin_id = $1
      ORDER BY d.numero ASC
    `, [req.user!.id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/departamentos/:numero
export async function getDepartamentoByNumero(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { numero } = req.params;
    const result = await pool.query(
      `SELECT d.*,
        (SELECT json_agg(json_build_object(
          'id', i.id, 'nombre', i.nombre_completo, 'renta', i.renta,
          'fecha_inicio', i.fecha_inicio, 'fecha_termino', i.fecha_termino,
          'estado', i.estado, 'created_at', i.created_at
        ) ORDER BY i.created_at DESC) FROM inquilinos i WHERE i.admin_id = d.admin_id AND i.depto_numero = d.numero) as historial_inquilinos
       FROM departamentos d WHERE d.admin_id = $1 AND d.numero = $2`,
      [req.user!.id, Number(numero)]
    );
    if (!result.rows[0]) throw new AppError('Departamento no encontrado', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/departamentos/:numero
export async function updateDepartamento(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { numero } = req.params;
    const { estado, descripcion, inventario_base } = req.body;

    const current = await pool.query(
      `SELECT * FROM departamentos WHERE admin_id = $1 AND numero = $2`, [req.user!.id, Number(numero)]
    );
    if (!current.rows[0]) throw new AppError('Departamento no encontrado', 404);
    const d = current.rows[0];

    const result = await pool.query(
      `UPDATE departamentos SET
        estado = $1, descripcion = $2, inventario_base = $3
       WHERE admin_id = $4 AND numero = $5 RETURNING *`,
      [
        estado ?? d.estado,
        descripcion ?? d.descripcion,
        inventario_base !== undefined ? JSON.stringify(inventario_base) : d.inventario_base,
        req.user!.id,
        Number(numero),
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/departamentos
export async function createDepartamento(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { numero, descripcion, inventario_base } = req.body;
    if (!numero) throw new AppError('El número de departamento es requerido', 400);

    const result = await pool.query(
      `INSERT INTO departamentos (admin_id, numero, descripcion, inventario_base)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        req.user!.id,
        Number(numero),
        descripcion || null,
        JSON.stringify(inventario_base || []),
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      next(new AppError(`El departamento número ${req.body.numero} ya existe`, 409));
    } else {
      next(err);
    }
  }
}

// DELETE /api/departamentos/:numero
export async function deleteDepartamento(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { numero } = req.params;
    const existing = await pool.query(`SELECT * FROM departamentos WHERE admin_id = $1 AND numero = $2`, [req.user!.id, Number(numero)]);
    if (!existing.rows[0]) throw new AppError('Departamento no encontrado', 404);

    const activos = await pool.query(
      `SELECT id FROM inquilinos WHERE admin_id = $1 AND depto_numero = $2 AND estado = 'activo'`, [req.user!.id, Number(numero)]
    );
    if (activos.rows.length > 0) {
      throw new AppError('No se puede eliminar un departamento con inquilinos activos', 400);
    }

    await pool.query(`DELETE FROM departamentos WHERE admin_id = $1 AND numero = $2`, [req.user!.id, Number(numero)]);
    res.json({ success: true, message: 'Departamento eliminado correctamente' });
  } catch (err) {
    next(err);
  }
}

// GET /api/departamentos/stats
export async function getDepartamentosStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'disponible') AS disponibles,
        COUNT(*) FILTER (WHERE estado = 'ocupado') AS ocupados,
        COUNT(*) FILTER (WHERE estado = 'mantenimiento') AS mantenimiento,
        COUNT(*) AS total,
        (SELECT COALESCE(SUM(renta), 0) FROM inquilinos WHERE admin_id = $1 AND estado = 'activo') AS ingresos_mensuales,
        (SELECT COUNT(*) FROM inquilinos WHERE admin_id = $1 AND fecha_termino <= NOW() + INTERVAL '30 days' AND estado = 'activo') AS contratos_por_vencer
      FROM departamentos WHERE admin_id = $1
    `, [req.user!.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
