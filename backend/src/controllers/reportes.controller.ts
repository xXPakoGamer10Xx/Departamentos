import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { ownerId } from '../utils/scope';

// GET /api/reportes/anual?year=YYYY — corte anual: renta, cuotas extra y depósitos cobrados
export async function getReporteAnual(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const year = parseInt(String(req.query.year), 10);
    if (!year || year < 2000 || year > 2100) throw new AppError('year inválido', 400);

    const adminId = ownerId(req);

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

// GET /api/reportes/mensual?year=YYYY — ingreso real (efectivo) mes a mes y por
// departamento. Se contabiliza por la FECHA en que entró el dinero (no el periodo
// que cubre): renta (abonos_pago.fecha), cuotas extra (pagado_en) y depósitos
// (abonos_deposito.fecha). Incluye inquilinos ya dados de baja — su historial se
// conserva (soft delete), así que su pago sigue contando en el mes en que ocurrió.
export async function getReporteMensual(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const year = parseInt(String(req.query.year), 10);
    if (!year || year < 2000 || year > 2100) throw new AppError('year inválido', 400);
    const adminId = ownerId(req);

    const [detalle, aniosRes] = await Promise.all([
      pool.query(
        `WITH ingresos AS (
           SELECT i.depto_numero, EXTRACT(MONTH FROM a.fecha)::int AS mes, 'renta' AS tipo, a.monto
           FROM abonos_pago a
           JOIN pagos p ON p.id = a.pago_id
           JOIN inquilinos i ON i.id = p.inquilino_id
           WHERE i.admin_id = $1 AND EXTRACT(YEAR FROM a.fecha) = $2
           UNION ALL
           SELECT i.depto_numero, EXTRACT(MONTH FROM c.pagado_en)::int, 'extra', c.monto
           FROM cuotas_extra c
           JOIN inquilinos i ON i.id = c.inquilino_id
           WHERE i.admin_id = $1 AND c.estado = 'pagado' AND EXTRACT(YEAR FROM c.pagado_en) = $2
           UNION ALL
           SELECT i.depto_numero, EXTRACT(MONTH FROM ad.fecha)::int, 'deposito', ad.monto
           FROM abonos_deposito ad
           JOIN inquilinos i ON i.id = ad.inquilino_id
           WHERE i.admin_id = $1 AND EXTRACT(YEAR FROM ad.fecha) = $2
         )
         SELECT depto_numero, mes, tipo, SUM(monto) AS total
         FROM ingresos
         GROUP BY depto_numero, mes, tipo`,
        [adminId, year]
      ),
      pool.query(
        `SELECT DISTINCT y FROM (
           SELECT EXTRACT(YEAR FROM a.fecha)::int AS y
           FROM abonos_pago a JOIN pagos p ON p.id = a.pago_id JOIN inquilinos i ON i.id = p.inquilino_id
           WHERE i.admin_id = $1
           UNION
           SELECT EXTRACT(YEAR FROM ad.fecha)::int
           FROM abonos_deposito ad JOIN inquilinos i ON i.id = ad.inquilino_id
           WHERE i.admin_id = $1
           UNION
           SELECT EXTRACT(YEAR FROM c.pagado_en)::int
           FROM cuotas_extra c JOIN inquilinos i ON i.id = c.inquilino_id
           WHERE i.admin_id = $1 AND c.pagado_en IS NOT NULL
         ) t WHERE y IS NOT NULL ORDER BY y DESC`,
        [adminId]
      ),
    ]);

    // Totales por mes (todos los departamentos juntos), separados por tipo.
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1, renta: 0, extra: 0, deposito: 0, total: 0,
    }));

    // Ingreso por departamento: total anual + arreglo de 12 meses.
    const deptoMap = new Map<number, { depto_numero: number; total: number; meses: number[] }>();

    for (const row of detalle.rows as any[]) {
      const mesIdx = row.mes - 1;
      const monto = parseFloat(row.total);
      if (mesIdx < 0 || mesIdx > 11) continue;

      (meses[mesIdx] as any)[row.tipo] += monto;
      meses[mesIdx].total += monto;

      let d = deptoMap.get(row.depto_numero);
      if (!d) {
        d = { depto_numero: row.depto_numero, total: 0, meses: Array(12).fill(0) };
        deptoMap.set(row.depto_numero, d);
      }
      d.total += monto;
      d.meses[mesIdx] += monto;
    }

    const por_departamento = [...deptoMap.values()].sort((a, b) => a.depto_numero - b.depto_numero);
    const total_anual = meses.reduce((s, m) => s + m.total, 0);

    res.json({
      success: true,
      data: {
        year,
        meses,
        por_departamento,
        total_anual,
        anios_disponibles: (aniosRes.rows as any[]).map(r => r.y),
      },
    });
  } catch (err) {
    next(err);
  }
}
