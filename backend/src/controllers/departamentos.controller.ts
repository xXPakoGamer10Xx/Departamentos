import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// GET /api/departamentos
export async function getDepartamentos(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
        ) FROM inquilinos i WHERE i.depto_numero = d.numero AND i.estado = 'activo'
        ORDER BY i.created_at DESC LIMIT 1) as inquilino_actual
      FROM departamentos d
      ORDER BY d.numero ASC
    `);
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
        ) ORDER BY i.created_at DESC) FROM inquilinos i WHERE i.depto_numero = d.numero) as historial_inquilinos
       FROM departamentos d WHERE d.numero = $1`,
      [Number(numero)]
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
      `SELECT * FROM departamentos WHERE numero = $1`, [Number(numero)]
    );
    if (!current.rows[0]) throw new AppError('Departamento no encontrado', 404);
    const d = current.rows[0];

    const result = await pool.query(
      `UPDATE departamentos SET
        estado = $1, descripcion = $2, inventario_base = $3
       WHERE numero = $4 RETURNING *`,
      [
        estado ?? d.estado,
        descripcion ?? d.descripcion,
        inventario_base !== undefined ? JSON.stringify(inventario_base) : d.inventario_base,
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
      `INSERT INTO departamentos (numero, descripcion, inventario_base)
       VALUES ($1, $2, $3) RETURNING *`,
      [
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
    const existing = await pool.query(`SELECT * FROM departamentos WHERE numero = $1`, [Number(numero)]);
    if (!existing.rows[0]) throw new AppError('Departamento no encontrado', 404);

    const activos = await pool.query(
      `SELECT id FROM inquilinos WHERE depto_numero = $1 AND estado = 'activo'`, [Number(numero)]
    );
    if (activos.rows.length > 0) {
      throw new AppError('No se puede eliminar un departamento con inquilinos activos', 400);
    }

    await pool.query(`DELETE FROM departamentos WHERE numero = $1`, [Number(numero)]);
    res.json({ success: true, message: 'Departamento eliminado correctamente' });
  } catch (err) {
    next(err);
  }
}

// GET /api/departamentos/stats
export async function getDepartamentosStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'disponible') AS disponibles,
        COUNT(*) FILTER (WHERE estado = 'ocupado') AS ocupados,
        COUNT(*) FILTER (WHERE estado = 'mantenimiento') AS mantenimiento,
        COUNT(*) AS total,
        (SELECT COALESCE(SUM(renta), 0) FROM inquilinos WHERE estado = 'activo') AS ingresos_mensuales,
        (SELECT COUNT(*) FROM inquilinos WHERE fecha_termino <= NOW() + INTERVAL '30 days' AND estado = 'activo') AS contratos_por_vencer
      FROM departamentos
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
