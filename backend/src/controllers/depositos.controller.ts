import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { createAndSendNotification } from '../services/push.service';

// GET /api/depositos/:inquilino_id/saldo — total, pagado y pendiente del depósito
export async function getSaldoDeposito(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id } = req.params;
    const rol = req.user!.rol;

    const authCheck = rol === 'inquilino' ? 'AND usuario_id = $2' : rol === 'admin' ? 'AND admin_id = $2' : '';
    const params = rol === 'cobrador' ? [inquilino_id] : [inquilino_id, req.user!.id];
    const inqRes = await pool.query(`SELECT id, deposito FROM inquilinos WHERE id = $1 ${authCheck}`, params);
    if (!inqRes.rows[0]) throw new AppError('No autorizado', 403);

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS pagado FROM abonos_deposito WHERE inquilino_id = $1`,
      [inquilino_id]
    );

    const depositoTotal = parseFloat(inqRes.rows[0].deposito);
    const depositoPagado = parseFloat(sumRes.rows[0].pagado);

    res.json({
      success: true,
      data: {
        deposito_total: depositoTotal,
        deposito_pagado: depositoPagado,
        deposito_saldo: Math.max(depositoTotal - depositoPagado, 0),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/depositos/:inquilino_id/abonos — historial de abonos al depósito
export async function getAbonosDeposito(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id } = req.params;
    const rol = req.user!.rol;

    const authCheck = rol === 'inquilino' ? 'AND usuario_id = $2' : rol === 'admin' ? 'AND admin_id = $2' : '';
    const params = rol === 'cobrador' ? [inquilino_id] : [inquilino_id, req.user!.id];
    const own = await pool.query(`SELECT id FROM inquilinos WHERE id = $1 ${authCheck}`, params);
    if (!own.rows[0]) throw new AppError('No autorizado', 403);

    const result = await pool.query(
      `SELECT a.*, u.nombre_completo AS registrado_por_nombre
       FROM abonos_deposito a
       LEFT JOIN usuarios u ON u.id = a.registrado_por
       WHERE a.inquilino_id = $1
       ORDER BY a.fecha ASC, a.created_at ASC`,
      [inquilino_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/depositos/abono — registrar un abono al depósito
export async function registrarAbonoDeposito(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id, monto, fecha, metodo, nota, comprobante_url } = req.body;

    if (!inquilino_id) throw new AppError('inquilino_id es requerido', 400);
    const montoAbono = parseFloat(monto);
    if (!montoAbono || montoAbono <= 0) throw new AppError('El monto del abono debe ser mayor a 0', 400);

    const whereAdmin = req.user!.rol === 'admin' ? 'AND admin_id = $2' : '';
    const params = req.user!.rol === 'admin' ? [inquilino_id, req.user!.id] : [inquilino_id];
    const inqRes = await pool.query(
      `SELECT * FROM inquilinos WHERE id = $1 ${whereAdmin} AND estado = 'activo'`,
      params
    );
    if (!inqRes.rows[0]) throw new AppError('Inquilino no encontrado o no autorizado', 404);
    const inquilino = inqRes.rows[0];

    const abonoRes = await pool.query(
      `INSERT INTO abonos_deposito (inquilino_id, monto, fecha, metodo, nota, comprobante_url, registrado_por)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7) RETURNING *`,
      [inquilino_id, montoAbono, fecha || null, metodo || inquilino.metodo_pago || 'efectivo', nota || null, comprobante_url || null, req.user!.id]
    );

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS pagado FROM abonos_deposito WHERE inquilino_id = $1`,
      [inquilino_id]
    );
    const depositoPagado = parseFloat(sumRes.rows[0].pagado);
    const depositoSaldo = Math.max(parseFloat(inquilino.deposito) - depositoPagado, 0);

    res.json({
      success: true,
      data: { abono: abonoRes.rows[0], deposito_pagado: depositoPagado, deposito_saldo: depositoSaldo },
    });

    if (inquilino.usuario_id) {
      createAndSendNotification(
        inquilino.usuario_id,
        '💰 Abono a depósito registrado',
        `Se registró un abono de $${montoAbono.toLocaleString('es-MX')} a tu depósito. Saldo pendiente: $${depositoSaldo.toLocaleString('es-MX')}`,
        'pago'
      ).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
}

// PUT /api/depositos/abono/:abono_id — corregir un abono al depósito
export async function editarAbonoDeposito(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { abono_id } = req.params;
    const { monto, fecha, metodo, nota } = req.body;

    const abonoRes = await pool.query(
      `SELECT a.* FROM abonos_deposito a
       JOIN inquilinos i ON i.id = a.inquilino_id
       WHERE a.id = $1 AND i.admin_id = $2`,
      [abono_id, req.user!.id]
    );
    if (!abonoRes.rows[0]) throw new AppError('Abono no encontrado o no autorizado', 404);

    if (monto !== undefined && (!parseFloat(monto) || parseFloat(monto) <= 0)) {
      throw new AppError('El monto del abono debe ser mayor a 0', 400);
    }

    const updated = await pool.query(
      `UPDATE abonos_deposito SET
         monto  = COALESCE($2, monto),
         fecha  = COALESCE($3, fecha),
         metodo = COALESCE($4, metodo),
         nota   = COALESCE($5, nota)
       WHERE id = $1 RETURNING *`,
      [abono_id, monto ?? null, fecha ?? null, metodo ?? null, nota ?? null]
    );

    res.json({ success: true, data: { abono: updated.rows[0] } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/depositos/abono/:abono_id — eliminar un abono al depósito
export async function eliminarAbonoDeposito(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { abono_id } = req.params;

    const abonoRes = await pool.query(
      `SELECT a.id FROM abonos_deposito a
       JOIN inquilinos i ON i.id = a.inquilino_id
       WHERE a.id = $1 AND i.admin_id = $2`,
      [abono_id, req.user!.id]
    );
    if (!abonoRes.rows[0]) throw new AppError('Abono no encontrado o no autorizado', 404);

    await pool.query(`DELETE FROM abonos_deposito WHERE id = $1`, [abono_id]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
