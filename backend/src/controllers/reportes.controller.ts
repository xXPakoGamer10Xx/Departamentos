import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// GET /api/reportes/anual?year=YYYY — corte anual: renta, cuotas extra y depósitos cobrados
export async function getReporteAnual(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const year = parseInt(String(req.query.year), 10);
    if (!year || year < 2000 || year > 2100) throw new AppError('year inválido', 400);

    const adminId = req.user!.id;

    const [rentaRes, extraRes, depositoRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(a.monto), 0) AS total
         FROM abonos_pago a
         JOIN pagos p ON p.id = a.pago_id
         JOIN inquilinos i ON i.id = p.inquilino_id
         WHERE i.admin_id = $1 AND EXTRACT(YEAR FROM a.fecha) = $2`,
        [adminId, year]
      ),
      pool.query(
        `SELECT COALESCE(SUM(c.monto), 0) AS total
         FROM cuotas_extra c
         JOIN inquilinos i ON i.id = c.inquilino_id
         WHERE i.admin_id = $1 AND c.estado = 'pagado' AND EXTRACT(YEAR FROM c.pagado_en) = $2`,
        [adminId, year]
      ),
      pool.query(
        `SELECT COALESCE(SUM(ad.monto), 0) AS total
         FROM abonos_deposito ad
         JOIN inquilinos i ON i.id = ad.inquilino_id
         WHERE i.admin_id = $1 AND EXTRACT(YEAR FROM ad.fecha) = $2`,
        [adminId, year]
      ),
    ]);

    const rentaTotal = parseFloat(rentaRes.rows[0].total);
    const extraTotal = parseFloat(extraRes.rows[0].total);
    const depositoTotal = parseFloat(depositoRes.rows[0].total);

    res.json({
      success: true,
      data: {
        year,
        renta_total: rentaTotal,
        extra_total: extraTotal,
        deposito_total: depositoTotal,
        total_general: rentaTotal + extraTotal + depositoTotal,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/reportes/mensual?year=YYYY — desglose mes a mes de renta y cuotas extra cobradas
export async function getReporteMensual(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const year = parseInt(String(req.query.year), 10);
    if (!year || year < 2000 || year > 2100) throw new AppError('year inválido', 400);
    const adminId = req.user!.id;

    const [rentaRes, extraRes] = await Promise.all([
      pool.query(
        `SELECT EXTRACT(MONTH FROM a.fecha)::int AS mes, COALESCE(SUM(a.monto), 0) AS total
         FROM abonos_pago a
         JOIN pagos p ON p.id = a.pago_id
         JOIN inquilinos i ON i.id = p.inquilino_id
         WHERE i.admin_id = $1 AND EXTRACT(YEAR FROM a.fecha) = $2
         GROUP BY 1`,
        [adminId, year]
      ),
      pool.query(
        `SELECT EXTRACT(MONTH FROM c.pagado_en)::int AS mes, COALESCE(SUM(c.monto), 0) AS total
         FROM cuotas_extra c
         JOIN inquilinos i ON i.id = c.inquilino_id
         WHERE i.admin_id = $1 AND c.estado = 'pagado' AND EXTRACT(YEAR FROM c.pagado_en) = $2
         GROUP BY 1`,
        [adminId, year]
      ),
    ]);

    const rentaByMes: Record<number, number> = {};
    rentaRes.rows.forEach((r: any) => { rentaByMes[r.mes] = parseFloat(r.total); });
    const extraByMes: Record<number, number> = {};
    extraRes.rows.forEach((r: any) => { extraByMes[r.mes] = parseFloat(r.total); });

    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      renta: rentaByMes[i + 1] || 0,
      extra: extraByMes[i + 1] || 0,
    }));

    res.json({ success: true, data: { year, meses } });
  } catch (err) {
    next(err);
  }
}
