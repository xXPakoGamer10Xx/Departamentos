import { Response, NextFunction } from 'express';
import { pool, withTransaction } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// GET /api/cuentas-bancarias — lista las cuentas del admin
export async function getCuentasBancarias(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT cb.*,
        (SELECT json_agg(d.numero ORDER BY d.numero)
           FROM departamentos d WHERE d.cuenta_bancaria_id = cb.id) AS departamentos
       FROM cuentas_bancarias cb
       WHERE cb.admin_id = $1
       ORDER BY cb.es_predeterminada DESC, cb.created_at ASC`,
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/cuentas-bancarias — crea una cuenta
export async function createCuentaBancaria(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.user!.id;
    const { alias, banco_nombre, banco_clabe, banco_titular } = req.body as Record<string, string>;

    if (!banco_clabe || !/^\d{18}$/.test(banco_clabe)) {
      throw new AppError('La CLABE interbancaria debe tener exactamente 18 dígitos', 400);
    }

    // ¿Es la primera cuenta del admin? entonces será la predeterminada.
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM cuentas_bancarias WHERE admin_id = $1`, [adminId]);
    const esPrimera = count.rows[0].n === 0;

    const result = await pool.query(
      `INSERT INTO cuentas_bancarias (admin_id, alias, banco_nombre, banco_clabe, banco_titular, es_predeterminada)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [adminId, alias?.trim() || null, banco_nombre?.trim() || null, banco_clabe, banco_titular?.trim() || null, esPrimera]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/cuentas-bancarias/:id — edita una cuenta
export async function updateCuentaBancaria(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { alias, banco_nombre, banco_clabe, banco_titular, activo } = req.body as Record<string, any>;

    const current = await pool.query(`SELECT * FROM cuentas_bancarias WHERE id = $1 AND admin_id = $2`, [id, adminId]);
    if (!current.rows[0]) throw new AppError('Cuenta no encontrada', 404);
    const c = current.rows[0];

    if (banco_clabe !== undefined && !/^\d{18}$/.test(banco_clabe)) {
      throw new AppError('La CLABE interbancaria debe tener exactamente 18 dígitos', 400);
    }

    const result = await pool.query(
      `UPDATE cuentas_bancarias SET
        alias = $1, banco_nombre = $2, banco_clabe = $3, banco_titular = $4, activo = $5, updated_at = NOW()
       WHERE id = $6 AND admin_id = $7 RETURNING *`,
      [
        alias !== undefined ? (alias?.trim() || null) : c.alias,
        banco_nombre !== undefined ? (banco_nombre?.trim() || null) : c.banco_nombre,
        banco_clabe ?? c.banco_clabe,
        banco_titular !== undefined ? (banco_titular?.trim() || null) : c.banco_titular,
        activo !== undefined ? !!activo : c.activo,
        id, adminId,
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/cuentas-bancarias/:id/predeterminada — marca como predeterminada
export async function setCuentaDefault(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;

    const data = await withTransaction(async (client) => {
      const owned = await client.query(`SELECT id FROM cuentas_bancarias WHERE id = $1 AND admin_id = $2`, [id, adminId]);
      if (!owned.rows[0]) throw new AppError('Cuenta no encontrada', 404);
      await client.query(`UPDATE cuentas_bancarias SET es_predeterminada = FALSE WHERE admin_id = $1`, [adminId]);
      const r = await client.query(
        `UPDATE cuentas_bancarias SET es_predeterminada = TRUE, activo = TRUE, updated_at = NOW()
         WHERE id = $1 AND admin_id = $2 RETURNING *`,
        [id, adminId]
      );
      return r.rows[0];
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cuentas-bancarias/:id — elimina una cuenta
export async function deleteCuentaBancaria(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;

    const current = await pool.query(`SELECT * FROM cuentas_bancarias WHERE id = $1 AND admin_id = $2`, [id, adminId]);
    if (!current.rows[0]) throw new AppError('Cuenta no encontrada', 404);

    // Los departamentos que la usaban quedan en NULL por el ON DELETE SET NULL.
    await pool.query(`DELETE FROM cuentas_bancarias WHERE id = $1 AND admin_id = $2`, [id, adminId]);

    // Si era la predeterminada, promover otra cuenta activa a predeterminada.
    if (current.rows[0].es_predeterminada) {
      await pool.query(
        `UPDATE cuentas_bancarias SET es_predeterminada = TRUE
         WHERE id = (SELECT id FROM cuentas_bancarias WHERE admin_id = $1 AND activo = TRUE
                     ORDER BY created_at ASC LIMIT 1)`,
        [adminId]
      );
    }
    res.json({ success: true, message: 'Cuenta eliminada' });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/cuentas-bancarias/departamento/:numero — asigna una cuenta a un departamento
export async function asignarCuentaDepto(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.user!.id;
    const { numero } = req.params;
    const { cuenta_bancaria_id } = req.body as { cuenta_bancaria_id: string | null };

    if (cuenta_bancaria_id) {
      const owned = await pool.query(
        `SELECT id FROM cuentas_bancarias WHERE id = $1 AND admin_id = $2`, [cuenta_bancaria_id, adminId]
      );
      if (!owned.rows[0]) throw new AppError('Cuenta no encontrada', 404);
    }

    const result = await pool.query(
      `UPDATE departamentos SET cuenta_bancaria_id = $1
       WHERE admin_id = $2 AND numero = $3 RETURNING numero, cuenta_bancaria_id`,
      [cuenta_bancaria_id || null, adminId, Number(numero)]
    );
    if (!result.rows[0]) throw new AppError('Departamento no encontrado', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
