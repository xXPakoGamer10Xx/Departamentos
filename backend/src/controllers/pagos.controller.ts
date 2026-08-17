import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { v4 as uuidv4 } from 'uuid';
import { sendPush, getUserPushTokens, getAdminPushTokens, createAndSendNotification } from '../services/push.service';
import { emitToUser, emitToAdmins } from '../services/sse.service';
import { recalcularPago } from '../services/saldo.service';

function getCurrentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// POST /api/pagos/generar-qr/:inquilino_id
export async function generarQr(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // El QR de pago lo genera únicamente el inquilino desde su app.
    // El admin/cobrador solo lo escanea para aceptar el pago en efectivo.
    if (req.user!.rol !== 'inquilino') {
      throw new AppError('Solo el inquilino puede generar su código QR de pago', 403);
    }

    const { inquilino_id } = req.params;
    const periodo = getCurrentPeriodo();

    const inqRes = await pool.query(
      `SELECT id, nombre_completo, depto_numero, renta, metodo_pago FROM inquilinos WHERE id = $1 AND usuario_id = $2 AND estado = 'activo'`,
      [inquilino_id, req.user!.id]
    );
    if (!inqRes.rows[0]) throw new AppError('Inquilino no encontrado o no autorizado', 403);
    const inquilino = inqRes.rows[0];

    // Sumar cuotas extra pendientes al monto
    const cuotasRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) as total_extra,
              json_agg(json_build_object('id', id, 'concepto', concepto, 'monto', monto)) FILTER (WHERE id IS NOT NULL) as cuotas
       FROM cuotas_extra WHERE inquilino_id = $1 AND estado = 'pendiente'`,
      [inquilino_id]
    );
    const totalExtra = parseFloat(cuotasRes.rows[0].total_extra);
    const cuotasDetalle = cuotasRes.rows[0].cuotas || [];
    const montoTotal = parseFloat(inquilino.renta) + totalExtra;

    let pagoRes = await pool.query(
      `SELECT * FROM pagos WHERE inquilino_id = $1 AND periodo = $2`,
      [inquilino_id, periodo]
    );

    if (!pagoRes.rows[0]) {
      const token = uuidv4();
      pagoRes = await pool.query(
        `INSERT INTO pagos (inquilino_id, periodo, monto, metodo, qr_token)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [inquilino_id, periodo, montoTotal, inquilino.metodo_pago || 'efectivo', token]
      );
    } else if (!pagoRes.rows[0].qr_token) {
      const token = uuidv4();
      pagoRes = await pool.query(
        `UPDATE pagos SET qr_token = $1, monto = $2 WHERE id = $3 RETURNING *`,
        [token, montoTotal, pagoRes.rows[0].id]
      );
    } else {
      // Refresh monto in case cuotas changed
      pagoRes = await pool.query(
        `UPDATE pagos SET monto = $1 WHERE id = $2 AND confirmado = false RETURNING *`,
        [montoTotal, pagoRes.rows[0].id]
      );
      if (!pagoRes.rows[0]) {
        pagoRes = await pool.query(`SELECT * FROM pagos WHERE inquilino_id = $1 AND periodo = $2`, [inquilino_id, periodo]);
      }
    }

    const pago = pagoRes.rows[0];
    res.json({
      success: true,
      data: {
        ...pago,
        renta_base: parseFloat(inquilino.renta),
        total_extra: totalExtra,
        cuotas: cuotasDetalle,
        inquilino: {
          nombre_completo: inquilino.nombre_completo,
          depto_numero: inquilino.depto_numero,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/pagos/info/:token  (sin auth – para la página de confirmación QR)
export async function getPagoByToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.params;
    const result = await pool.query(
      `SELECT p.*, i.nombre_completo, i.depto_numero, i.renta
       FROM pagos p JOIN inquilinos i ON i.id = p.inquilino_id
       WHERE p.qr_token = $1`,
      [token]
    );
    if (!result.rows[0]) throw new AppError('QR inválido o expirado', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/pagos/confirmar/:token  (sin auth – se confirma desde QR scan)
export async function confirmarPago(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.params;

    const pagoRes = await pool.query(
      `SELECT p.*, i.nombre_completo, i.depto_numero, i.admin_id
       FROM pagos p JOIN inquilinos i ON i.id = p.inquilino_id
       WHERE p.qr_token = $1`,
      [token]
    );
    if (!pagoRes.rows[0]) throw new AppError('QR inválido o expirado', 404);

    const pago = pagoRes.rows[0];
    if (pago.confirmado) {
      res.json({ success: true, data: pago, yaConfirmado: true });
      return;
    }

    const scannerId: string | null = (req as any).user?.id || req.body?.scanner_id || null;

    await pool.query(
      `UPDATE pagos SET escaneado_por = $2, escaneado_en = NOW() WHERE id = $1`,
      [pago.id, scannerId]
    );

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM abonos_pago WHERE pago_id = $1`,
      [pago.id]
    );
    const saldoPendiente = Math.max(parseFloat(pago.monto) - parseFloat(sumRes.rows[0].total), 0);
    if (saldoPendiente > 0) {
      await pool.query(
        `INSERT INTO abonos_pago (pago_id, monto, metodo, nota, registrado_por)
         VALUES ($1, $2, $3, $4, $5)`,
        [pago.id, saldoPendiente, pago.metodo, 'Confirmado por escaneo de QR', scannerId]
      );
    }
    const { pago: pagoActualizado } = await recalcularPago(pago.id);

    res.json({
      success: true,
      data: {
        ...pagoActualizado,
        nombre_completo: pago.nombre_completo,
        depto_numero: pago.depto_numero,
      },
    });

    // Notificar en tiempo real (SSE + push) a Inquilino
    const pagoData = { ...pagoActualizado, nombre_completo: pago.nombre_completo, depto_numero: pago.depto_numero };
    pool.query(`SELECT usuario_id FROM inquilinos WHERE id = $1`, [pago.inquilino_id])
      .then(async inqRes => {
        const usuarioId = inqRes.rows[0]?.usuario_id;
        const tasks: Promise<any>[] = [];
        if (usuarioId) {
          emitToUser(usuarioId, 'payment_confirmed', { pago: pagoData });
          tasks.push(createAndSendNotification(usuarioId, '✅ ¡Pago confirmado!', `Tu pago de ${pago.periodo} fue confirmado`, 'pago'));
        }
        return Promise.all(tasks);
      }).catch(() => {});
  } catch (err) {
    next(err);
  }
}

// POST /api/pagos/rechazar-admin/:pago_id  — admin rechaza comprobante enviado
export async function rechazarPagoAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pago_id } = req.params;
    const { comentario } = req.body;

    const pagoRes = await pool.query(
      `SELECT p.*, i.nombre_completo, i.depto_numero, i.usuario_id as inquilino_usuario_id, i.admin_id
       FROM pagos p JOIN inquilinos i ON i.id = p.inquilino_id
       WHERE p.id = $1 AND i.admin_id = $2`,
      [pago_id, req.user!.id]
    );
    if (!pagoRes.rows[0]) throw new AppError('Pago no encontrado o no autorizado', 404);
    const pago = pagoRes.rows[0];

    if (pago.confirmado) throw new AppError('El pago ya fue confirmado y no puede rechazarse', 400);

    const updated = await pool.query(
      `UPDATE pagos SET rechazado = true, rechazado_en = NOW(), comentario_admin = $2
       WHERE id = $1 RETURNING *`,
      [pago_id, comentario?.trim() || null]
    );

    const pagoData = {
      ...updated.rows[0],
      nombre_completo: pago.nombre_completo,
      depto_numero: pago.depto_numero,
    };
    res.json({ success: true, data: pagoData });

    // Notificar al inquilino
    if (pago.inquilino_usuario_id) {
      emitToUser(pago.inquilino_usuario_id, 'payment_rejected', { pago: pagoData });
      const razon = comentario?.trim()
        ? `Razón: ${comentario.trim()}`
        : `Por favor envía un nuevo comprobante.`;
      createAndSendNotification(
        pago.inquilino_usuario_id,
        '❌ Comprobante rechazado',
        `Tu comprobante de ${pago.periodo} fue rechazado. ${razon}`,
        'pago'
      ).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
}

// POST /api/pagos/comprobante/:inquilino_id  — inquilino sube imagen de comprobante
export async function subirComprobante(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id } = req.params;
    const { comprobante_url } = req.body;

    if (!comprobante_url) throw new AppError('comprobante_url es requerido', 400);

    let authCheck = req.user!.rol === 'inquilino' ? 'AND usuario_id = $2' : 'AND admin_id = $2';
    const own = await pool.query(`SELECT id FROM inquilinos WHERE id = $1 ${authCheck}`, [inquilino_id, req.user!.id]);
    if (!own.rows[0]) throw new AppError('No autorizado', 403);

    const periodo = getCurrentPeriodo();
    let pagoRes = await pool.query(
      `SELECT * FROM pagos WHERE inquilino_id = $1 AND periodo = $2`,
      [inquilino_id, periodo]
    );

    if (!pagoRes.rows[0]) {
      const inqRes = await pool.query(
        `SELECT renta, metodo_pago FROM inquilinos WHERE id = $1`,
        [inquilino_id]
      );
      const cuotasRes = await pool.query(
        `SELECT COALESCE(SUM(monto), 0) as total_extra FROM cuotas_extra WHERE inquilino_id = $1 AND estado = 'pendiente'`,
        [inquilino_id]
      );
      const montoTotal = parseFloat(inqRes.rows[0].renta) + parseFloat(cuotasRes.rows[0].total_extra);
      pagoRes = await pool.query(
        `INSERT INTO pagos (inquilino_id, periodo, monto, metodo) VALUES ($1, $2, $3, $4) RETURNING *`,
        [inquilino_id, periodo, montoTotal, 'transferencia']
      );
    }

    const updated = await pool.query(
      `UPDATE pagos SET comprobante_url = $1, comprobante_subido_en = NOW(),
         rechazado = false, rechazado_en = NULL, comentario_admin = NULL
       WHERE id = $2 AND confirmado = false RETURNING *`,
      [comprobante_url, pagoRes.rows[0].id]
    );

    if (!updated.rows[0]) throw new AppError('Pago ya confirmado o no encontrado', 400);

    res.json({ success: true, data: updated.rows[0] });

    // Notificar al admin de este inquilino
    const inqName = await pool.query(
      `SELECT nombre_completo, depto_numero, admin_id FROM inquilinos WHERE id = $1`,
      [inquilino_id]
    );
    const inq = inqName.rows[0];
    if (inq.admin_id) {
       emitToUser(inq.admin_id, 'comprobante_subido', { pago: updated.rows[0], inquilino: inq });
       createAndSendNotification(inq.admin_id, '📎 Comprobante recibido', `Depto ${inq.depto_numero} — ${inq.nombre_completo}`, 'pago');
    }
  } catch (err) {
    next(err);
  }
}

// POST /api/pagos/confirmar-admin/:pago_id  — admin confirma pago de transferencia
export async function confirmarPagoAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pago_id } = req.params;

    const pagoRes = await pool.query(
      `SELECT p.*, i.nombre_completo, i.depto_numero, i.usuario_id as inquilino_usuario_id, i.admin_id
       FROM pagos p JOIN inquilinos i ON i.id = p.inquilino_id
       WHERE p.id = $1 AND i.admin_id = $2`,
      [pago_id, req.user!.id]
    );
    if (!pagoRes.rows[0]) throw new AppError('Pago no encontrado o no autorizado', 404);
    const pago = pagoRes.rows[0];

    if (pago.confirmado) {
      res.json({ success: true, data: pago, yaConfirmado: true });
      return;
    }

    await pool.query(
      `UPDATE pagos SET escaneado_por = $2, escaneado_en = NOW() WHERE id = $1`,
      [pago_id, req.user!.id]
    );

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM abonos_pago WHERE pago_id = $1`,
      [pago_id]
    );
    const saldoPendiente = Math.max(parseFloat(pago.monto) - parseFloat(sumRes.rows[0].total), 0);
    if (saldoPendiente > 0) {
      await pool.query(
        `INSERT INTO abonos_pago (pago_id, monto, metodo, nota, registrado_por)
         VALUES ($1, $2, $3, $4, $5)`,
        [pago_id, saldoPendiente, pago.metodo, 'Confirmado por admin (comprobante)', req.user!.id]
      );
    }
    const { pago: pagoActualizado } = await recalcularPago(pago_id);

    const pagoData = {
      ...pagoActualizado,
      nombre_completo: pago.nombre_completo,
      depto_numero: pago.depto_numero,
    };
    res.json({ success: true, data: pagoData });

    if (pago.inquilino_usuario_id) {
      emitToUser(pago.inquilino_usuario_id, 'payment_confirmed', { pago: pagoData });
      createAndSendNotification(pago.inquilino_usuario_id, '✅ ¡Pago confirmado!', `Tu pago de ${pago.periodo} fue confirmado`, 'pago').catch(() => {});
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/pagos/comprobantes-pendientes  — para cobrador y admin
export async function getComprobantesPendientes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const rol = req.user!.rol;

    // Admin ve solo los suyos; cobrador ve todos (sin restricción de admin_id)
    const whereAdmin = rol === 'admin' ? 'AND i.admin_id = $1' : '';
    const params = rol === 'admin' ? [req.user!.id] : [];

    const result = await pool.query(
      `SELECT p.id, p.monto, p.periodo, p.comprobante_url, p.comprobante_subido_en,
              i.nombre_completo, i.depto_numero, i.id AS inquilino_id
       FROM pagos p
       JOIN inquilinos i ON i.id = p.inquilino_id
       WHERE p.comprobante_url IS NOT NULL
         AND p.confirmado = false
         AND p.rechazado = false
         ${whereAdmin}
       ORDER BY p.comprobante_subido_en DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/pagos/historial/:inquilino_id
export async function getHistorialPagos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id } = req.params;

    const rol = req.user!.rol;
    const authCheck = rol === 'inquilino' ? 'AND usuario_id = $2' : 'AND admin_id = $2';
    const own = rol === 'cobrador'
      ? await pool.query(`SELECT id FROM inquilinos WHERE id = $1`, [inquilino_id])
      : await pool.query(`SELECT id FROM inquilinos WHERE id = $1 ${authCheck}`, [inquilino_id, req.user!.id]);
    if (!own.rows[0]) throw new AppError('No autorizado', 403);

    const result = await pool.query(
      `SELECT p.*,
              i.fecha_pago, i.nombre_completo, i.depto_numero,
              u.nombre_completo AS escaneado_por_nombre
       FROM pagos p
       JOIN inquilinos i ON i.id = p.inquilino_id
       LEFT JOIN usuarios u ON u.id = p.escaneado_por
       WHERE p.inquilino_id = $1
       ORDER BY p.periodo DESC`,
      [inquilino_id]
    );

    const pagos = result.rows.map(p => {
      let a_tiempo: boolean | null = null;
      if (p.confirmado && p.confirmado_en && p.fecha_pago) {
        const confirmadoDate = new Date(p.confirmado_en);
        const [anio, mes] = p.periodo.split('-').map(Number);
        const diaPago = parseInt(p.fecha_pago, 10);
        const fechaLimite = new Date(anio, mes - 1, diaPago, 23, 59, 59);
        a_tiempo = confirmadoDate <= fechaLimite;
      }
      return { ...p, a_tiempo };
    });

    res.json({ success: true, data: pagos });
  } catch (err) {
    next(err);
  }
}

// POST /api/pagos/marcar-pagado/:inquilino_id  — admin marca como pagado sin QR ni comprobante
export async function marcarPagadoAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id } = req.params;
    const periodo = getCurrentPeriodo();

    const inqRes = await pool.query(
      `SELECT * FROM inquilinos WHERE id = $1 AND admin_id = $2 AND estado = 'activo'`,
      [inquilino_id, req.user!.id]
    );
    if (!inqRes.rows[0]) throw new AppError('Inquilino no encontrado o no autorizado', 404);
    const inquilino = inqRes.rows[0];

    let pagoRes = await pool.query(
      `SELECT * FROM pagos WHERE inquilino_id = $1 AND periodo = $2`,
      [inquilino_id, periodo]
    );

    if (!pagoRes.rows[0]) {
      const cuotasRes = await pool.query(
        `SELECT COALESCE(SUM(monto), 0) as total_extra FROM cuotas_extra WHERE inquilino_id = $1 AND estado = 'pendiente'`,
        [inquilino_id]
      );
      const montoTotal = parseFloat(inquilino.renta) + parseFloat(cuotasRes.rows[0].total_extra);
      pagoRes = await pool.query(
        `INSERT INTO pagos (inquilino_id, periodo, monto, metodo) VALUES ($1, $2, $3, $4) RETURNING *`,
        [inquilino_id, periodo, montoTotal, inquilino.metodo_pago || 'efectivo']
      );
    } else if (pagoRes.rows[0].confirmado) {
      res.json({ success: true, data: pagoRes.rows[0], yaConfirmado: true });
      return;
    }

    const pagoId = pagoRes.rows[0].id;
    await pool.query(
      `UPDATE pagos SET escaneado_por = $2, escaneado_en = NOW() WHERE id = $1`,
      [pagoId, req.user!.id]
    );

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM abonos_pago WHERE pago_id = $1`,
      [pagoId]
    );
    const saldoPendiente = Math.max(parseFloat(pagoRes.rows[0].monto) - parseFloat(sumRes.rows[0].total), 0);
    if (saldoPendiente > 0) {
      await pool.query(
        `INSERT INTO abonos_pago (pago_id, monto, metodo, nota, registrado_por)
         VALUES ($1, $2, $3, $4, $5)`,
        [pagoId, saldoPendiente, inquilino.metodo_pago || 'efectivo', 'Marcado como pagado completo por admin', req.user!.id]
      );
    }
    const { pago: pagoActualizado } = await recalcularPago(pagoId);

    const pagoData = {
      ...pagoActualizado,
      nombre_completo: inquilino.nombre_completo,
      depto_numero: inquilino.depto_numero,
    };
    res.json({ success: true, data: pagoData });

    if (inquilino.usuario_id) {
      emitToUser(inquilino.usuario_id, 'payment_confirmed', { pago: pagoData });
      createAndSendNotification(
        inquilino.usuario_id,
        '✅ ¡Pago confirmado!',
        `Tu pago de ${periodo} fue confirmado por el administrador`,
        'pago'
      ).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/pagos/estados-actuales  — estado del periodo actual para los inquilinos activos
export async function getEstadosPagosActuales(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const rol = req.user!.rol;
    const periodo = getCurrentPeriodo();

    // Admin ve solo los suyos; cobrador ve todos (igual que comprobantes-pendientes)
    const whereAdmin = rol === 'admin' ? 'AND i.admin_id = $2' : '';
    const params = rol === 'admin' ? [periodo, req.user!.id] : [periodo];

    const result = await pool.query(
      `SELECT i.id AS inquilino_id,
              p.id AS pago_id,
              p.monto,
              COALESCE(p.confirmado, false) AS confirmado,
              COALESCE(p.rechazado, false) AS rechazado,
              p.comprobante_url,
              COALESCE(ab.total_abonado, 0) AS total_abonado
       FROM inquilinos i
       LEFT JOIN pagos p ON p.inquilino_id = i.id AND p.periodo = $1
       LEFT JOIN LATERAL (
         SELECT SUM(monto) AS total_abonado FROM abonos_pago WHERE pago_id = p.id
       ) ab ON true
       WHERE i.estado = 'activo' ${whereAdmin}`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/pagos/estado/:inquilino_id
export async function getEstadoPago(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id } = req.params;
    const periodo = getCurrentPeriodo();

    let authCheck = req.user!.rol === 'inquilino' ? 'AND usuario_id = $2' : 'AND admin_id = $2';
    const own = await pool.query(`SELECT id FROM inquilinos WHERE id = $1 ${authCheck}`, [inquilino_id, req.user!.id]);
    if (!own.rows[0]) throw new AppError('No autorizado', 403);

    const [pagoResult, cuotasResult] = await Promise.all([
      pool.query(`SELECT * FROM pagos WHERE inquilino_id = $1 AND periodo = $2`, [inquilino_id, periodo]),
      pool.query(
        `SELECT id, concepto, monto, estado, created_at FROM cuotas_extra
         WHERE inquilino_id = $1 AND estado = 'pendiente' ORDER BY created_at`,
        [inquilino_id]
      ),
    ]);

    const totalExtra = cuotasResult.rows.reduce((sum, c) => sum + parseFloat(c.monto), 0);
    const pago = pagoResult.rows[0] || null;

    let totalAbonado = 0;
    if (pago) {
      const abonoSum = await pool.query(
        `SELECT COALESCE(SUM(monto), 0) AS total FROM abonos_pago WHERE pago_id = $1`,
        [pago.id]
      );
      totalAbonado = parseFloat(abonoSum.rows[0].total);
    }

    res.json({
      success: true,
      data: pago,
      cuotas: cuotasResult.rows,
      total_extra: totalExtra,
      total_abonado: totalAbonado,
      saldo_pendiente: pago ? Math.max(parseFloat(pago.monto) - totalAbonado, 0) : 0,
      periodo,
    });
  } catch (err) {
    next(err);
  }
}

// Obtiene (o crea) el pago de un periodo con su monto = renta + cuotas extra pendientes
async function getOrCrearPago(inquilino: any, periodo: string) {
  let pagoRes = await pool.query(
    `SELECT * FROM pagos WHERE inquilino_id = $1 AND periodo = $2`,
    [inquilino.id, periodo]
  );
  if (pagoRes.rows[0]) return pagoRes.rows[0];

  const cuotasRes = await pool.query(
    `SELECT COALESCE(SUM(monto), 0) as total_extra FROM cuotas_extra WHERE inquilino_id = $1 AND estado = 'pendiente'`,
    [inquilino.id]
  );
  const montoTotal = parseFloat(inquilino.renta) + parseFloat(cuotasRes.rows[0].total_extra);
  pagoRes = await pool.query(
    `INSERT INTO pagos (inquilino_id, periodo, monto, metodo) VALUES ($1, $2, $3, $4) RETURNING *`,
    [inquilino.id, periodo, montoTotal, inquilino.metodo_pago || 'efectivo']
  );
  return pagoRes.rows[0];
}

// POST /api/pagos/abono — registrar un abono (pago parcial o total) a un periodo
export async function registrarAbono(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id, periodo, monto, fecha, metodo, nota, comprobante_url } = req.body;

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

    const periodoFinal = periodo || getCurrentPeriodo();
    const pago = await getOrCrearPago(inquilino, periodoFinal);

    if (pago.confirmado) throw new AppError('Este periodo ya está pagado por completo', 400);

    const abonoRes = await pool.query(
      `INSERT INTO abonos_pago (pago_id, monto, fecha, metodo, nota, comprobante_url, registrado_por)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7) RETURNING *`,
      [pago.id, montoAbono, fecha || null, metodo || inquilino.metodo_pago || 'efectivo', nota || null, comprobante_url || null, req.user!.id]
    );

    const { pago: pagoActualizado, totalAbonado, completo, saldoPendiente } = await recalcularPago(pago.id);

    res.json({
      success: true,
      data: { abono: abonoRes.rows[0], pago: pagoActualizado, totalAbonado, saldoPendiente },
    });

    const pagoData = { ...pagoActualizado, nombre_completo: inquilino.nombre_completo, depto_numero: inquilino.depto_numero };
    if (inquilino.usuario_id) {
      if (completo) {
        emitToUser(inquilino.usuario_id, 'payment_confirmed', { pago: pagoData });
        createAndSendNotification(inquilino.usuario_id, '✅ ¡Pago confirmado!', `Tu pago de ${periodoFinal} fue confirmado`, 'pago').catch(() => {});
      } else {
        createAndSendNotification(
          inquilino.usuario_id,
          '💰 Abono registrado',
          `Se registró un abono de $${montoAbono.toLocaleString('es-MX')} a tu renta de ${periodoFinal}. Saldo pendiente: $${saldoPendiente.toLocaleString('es-MX')}`,
          'pago'
        ).catch(() => {});
      }
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/pagos/abonos/:pago_id — historial de abonos de un periodo
export async function getAbonosPago(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pago_id } = req.params;
    const rol = req.user!.rol;

    const authCheck = rol === 'inquilino' ? 'AND i.usuario_id = $2' : rol === 'admin' ? 'AND i.admin_id = $2' : '';
    const params = rol === 'cobrador' ? [pago_id] : [pago_id, req.user!.id];
    const own = await pool.query(
      `SELECT p.id FROM pagos p JOIN inquilinos i ON i.id = p.inquilino_id WHERE p.id = $1 ${authCheck}`,
      params
    );
    if (!own.rows[0]) throw new AppError('No autorizado', 403);

    const result = await pool.query(
      `SELECT a.*, u.nombre_completo AS registrado_por_nombre
       FROM abonos_pago a
       LEFT JOIN usuarios u ON u.id = a.registrado_por
       WHERE a.pago_id = $1
       ORDER BY a.fecha ASC, a.created_at ASC`,
      [pago_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// PUT /api/pagos/abono/:abono_id — corregir un abono
export async function editarAbono(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { abono_id } = req.params;
    const { monto, fecha, metodo, nota } = req.body;

    const abonoRes = await pool.query(
      `SELECT a.*, p.id AS pago_id
       FROM abonos_pago a
       JOIN pagos p ON p.id = a.pago_id
       JOIN inquilinos i ON i.id = p.inquilino_id
       WHERE a.id = $1 AND i.admin_id = $2`,
      [abono_id, req.user!.id]
    );
    if (!abonoRes.rows[0]) throw new AppError('Abono no encontrado o no autorizado', 404);

    if (monto !== undefined && (!parseFloat(monto) || parseFloat(monto) <= 0)) {
      throw new AppError('El monto del abono debe ser mayor a 0', 400);
    }

    const updated = await pool.query(
      `UPDATE abonos_pago SET
         monto  = COALESCE($2, monto),
         fecha  = COALESCE($3, fecha),
         metodo = COALESCE($4, metodo),
         nota   = COALESCE($5, nota)
       WHERE id = $1 RETURNING *`,
      [abono_id, monto ?? null, fecha ?? null, metodo ?? null, nota ?? null]
    );

    const { pago, totalAbonado, saldoPendiente } = await recalcularPago(abonoRes.rows[0].pago_id);

    res.json({ success: true, data: { abono: updated.rows[0], pago, totalAbonado, saldoPendiente } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/pagos/abono/:abono_id — eliminar un abono
export async function eliminarAbono(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { abono_id } = req.params;

    const abonoRes = await pool.query(
      `SELECT a.pago_id
       FROM abonos_pago a
       JOIN pagos p ON p.id = a.pago_id
       JOIN inquilinos i ON i.id = p.inquilino_id
       WHERE a.id = $1 AND i.admin_id = $2`,
      [abono_id, req.user!.id]
    );
    if (!abonoRes.rows[0]) throw new AppError('Abono no encontrado o no autorizado', 404);

    await pool.query(`DELETE FROM abonos_pago WHERE id = $1`, [abono_id]);

    const { pago, totalAbonado, saldoPendiente } = await recalcularPago(abonoRes.rows[0].pago_id);

    res.json({ success: true, data: { pago, totalAbonado, saldoPendiente } });
  } catch (err) {
    next(err);
  }
}

// GET /api/pagos/saldo/:inquilino_id — desglose de deuda por periodo
export async function getSaldoInquilino(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inquilino_id } = req.params;

    const authCheck = req.user!.rol === 'inquilino' ? 'AND usuario_id = $2' : req.user!.rol === 'admin' ? 'AND admin_id = $2' : '';
    const params = req.user!.rol === 'cobrador' ? [inquilino_id] : [inquilino_id, req.user!.id];
    const inqRes = await pool.query(`SELECT id, renta, fecha_inicio FROM inquilinos WHERE id = $1 ${authCheck}`, params);
    if (!inqRes.rows[0]) throw new AppError('No autorizado', 403);
    const inquilino = inqRes.rows[0];

    const detalle = await pool.query(
      `WITH periodos AS (
         SELECT to_char(gs, 'YYYY-MM') AS periodo
         FROM generate_series(
           date_trunc('month', $2::date), date_trunc('month', CURRENT_DATE), interval '1 month'
         ) AS gs
       ),
       cuotas AS (
         SELECT periodo, SUM(monto) AS total FROM cuotas_extra WHERE inquilino_id = $1 GROUP BY periodo
       ),
       abonado AS (
         SELECT p.periodo, COALESCE(SUM(a.monto), 0) AS total
         FROM pagos p LEFT JOIN abonos_pago a ON a.pago_id = p.id
         WHERE p.inquilino_id = $1 GROUP BY p.periodo
       )
       SELECT pe.periodo,
              ($3::numeric + COALESCE(c.total, 0)) AS monto_esperado,
              COALESCE(ab.total, 0) AS abonado,
              GREATEST($3::numeric + COALESCE(c.total, 0) - COALESCE(ab.total, 0), 0) AS saldo
       FROM periodos pe
       LEFT JOIN cuotas c ON c.periodo = pe.periodo
       LEFT JOIN abonado ab ON ab.periodo = pe.periodo
       ORDER BY pe.periodo`,
      [inquilino_id, inquilino.fecha_inicio, inquilino.renta]
    );

    const deudaTotal = detalle.rows.reduce((sum, r) => sum + parseFloat(r.saldo), 0);

    res.json({ success: true, data: { deuda_total: deudaTotal, detalle: detalle.rows } });
  } catch (err) {
    next(err);
  }
}

// GET /api/pagos/saldos — deuda total de todos los inquilinos activos (para la lista)
export async function getSaldosInquilinos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const rol = req.user!.rol;
    const whereAdmin = rol === 'admin' ? 'AND i.admin_id = $1' : '';
    const params = rol === 'admin' ? [req.user!.id] : [];

    const result = await pool.query(
      `SELECT i.id AS inquilino_id,
              COALESCE(SUM(GREATEST(i.renta + COALESCE(cx.total, 0) - COALESCE(ab.total, 0), 0)), 0) AS deuda_total
       FROM inquilinos i
       CROSS JOIN LATERAL generate_series(
         date_trunc('month', i.fecha_inicio), date_trunc('month', CURRENT_DATE), interval '1 month'
       ) AS gs
       LEFT JOIN LATERAL (
         SELECT SUM(monto) AS total FROM cuotas_extra
         WHERE inquilino_id = i.id AND periodo = to_char(gs, 'YYYY-MM')
       ) cx ON true
       LEFT JOIN LATERAL (
         SELECT SUM(a.monto) AS total FROM pagos p JOIN abonos_pago a ON a.pago_id = p.id
         WHERE p.inquilino_id = i.id AND p.periodo = to_char(gs, 'YYYY-MM')
       ) ab ON true
       WHERE i.estado = 'activo' ${whereAdmin}
       GROUP BY i.id`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}
