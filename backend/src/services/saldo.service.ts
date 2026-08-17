import { pool } from '../config/database';

export interface RecalculoPago {
  pago: any;
  totalAbonado: number;
  completo: boolean;
  saldoPendiente: number;
}

// Recalcula el estado de un pago (periodo) a partir de la suma de sus abonos.
// Centraliza la transición pendiente/parcial/pagado y el marcado de cuotas
// extra del mismo periodo, para que todos los flujos de confirmación
// (QR, comprobante, marcar-pagado, abono manual) queden consistentes.
export async function recalcularPago(pagoId: string): Promise<RecalculoPago> {
  const pagoRes = await pool.query(`SELECT * FROM pagos WHERE id = $1`, [pagoId]);
  const pago = pagoRes.rows[0];
  if (!pago) throw new Error(`Pago ${pagoId} no encontrado`);

  const sumRes = await pool.query(
    `SELECT COALESCE(SUM(monto), 0) AS total FROM abonos_pago WHERE pago_id = $1`,
    [pagoId]
  );
  const totalAbonado = parseFloat(sumRes.rows[0].total);
  const monto = parseFloat(pago.monto);
  const completo = totalAbonado >= monto - 0.01;

  if (completo && !pago.confirmado) {
    await pool.query(
      `UPDATE pagos SET confirmado = true, confirmado_en = NOW() WHERE id = $1`,
      [pagoId]
    );
    await pool.query(
      `UPDATE cuotas_extra SET estado = 'pagado', pagado_en = NOW()
       WHERE inquilino_id = $1 AND periodo = $2 AND estado = 'pendiente'`,
      [pago.inquilino_id, pago.periodo]
    );
  } else if (!completo && pago.confirmado) {
    // Se editó/eliminó un abono y el pago dejó de estar completo: reabrir.
    await pool.query(
      `UPDATE pagos SET confirmado = false, confirmado_en = NULL WHERE id = $1`,
      [pagoId]
    );
  }

  const refreshed = (await pool.query(`SELECT * FROM pagos WHERE id = $1`, [pagoId])).rows[0];
  return {
    pago: refreshed,
    totalAbonado,
    completo,
    saldoPendiente: Math.max(monto - totalAbonado, 0),
  };
}
