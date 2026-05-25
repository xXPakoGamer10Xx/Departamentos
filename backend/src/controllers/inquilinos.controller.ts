import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { toTitleCase } from '../utils/formatters';
import { PdfService } from '../services/PdfService';
import { v4 as uuidv4 } from 'uuid';

// GET /api/inquilinos/mi-depto — para el inquilino autenticado
export async function getMiDepto(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT i.*
       FROM inquilinos i
       WHERE i.usuario_id = $1 AND i.estado = 'activo'
       LIMIT 1`,
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    next(err);
  }
}

// GET /api/inquilinos
export async function getInquilinos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, estado, depto } = req.query;

    let query = `
      SELECT i.*,
        (SELECT json_build_object(
          'id', u.id, 'nombre', u.nombre_completo, 'email', u.email
        ) FROM usuarios u WHERE u.id = i.usuario_id) as usuario,
        (SELECT json_build_object(
          'ultimo_accion', a.accion,
          'ultimo_usuario', (SELECT nombre_completo FROM usuarios WHERE id = a.usuario_id),
          'ultima_fecha', a.created_at
        ) FROM auditoria a WHERE a.registro_id = i.id ORDER BY a.created_at DESC LIMIT 1) as auditoria
      FROM inquilinos i
      WHERE i.admin_id = $1
    `;
    const params: any[] = [req.user!.id];
    let paramIdx = 2;

    if (search) {
      query += ` AND (
        i.nombre_completo ILIKE $${paramIdx} OR
        i.fiador_nombre ILIKE $${paramIdx} OR
        i.tel_arrendatario ILIKE $${paramIdx} OR
        i.depto_numero::text = $${paramIdx + 1}
      )`;
      params.push(`%${search}%`, String(search));
      paramIdx += 2;
    }

    if (estado) {
      query += ` AND i.estado = $${paramIdx}`;
      params.push(estado);
      paramIdx++;
    }

    if (depto) {
      query += ` AND i.depto_numero = $${paramIdx}`;
      params.push(Number(depto));
      paramIdx++;
    }

    query += ' ORDER BY i.depto_numero ASC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
}

// GET /api/inquilinos/:id
export async function getInquilinoById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT i.*,
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'accion', a.accion,
          'usuario', (SELECT nombre_completo FROM usuarios WHERE id = a.usuario_id),
          'datos_anteriores', a.datos_anteriores,
          'datos_nuevos', a.datos_nuevos,
          'fecha', a.created_at
        ) ORDER BY a.created_at DESC) 
        FROM auditoria a WHERE a.registro_id = i.id) as historial
       FROM inquilinos i WHERE i.admin_id = $1 AND i.id = $2`,
      [req.user!.id, req.params.id]
    );

    if (!result.rows[0]) throw new AppError('Inquilino no encontrado', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/inquilinos
export async function createInquilino(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      nombre_completo, nombre,
      depto_numero, depto,
      renta,
      renta_letra, rentaLetra,
      deposito,
      fecha_pago, fechaPago,
      fecha_inicio, fechaInicio,
      fecha_termino, fechaTermino,
      fiador_nombre, fiador,
      tel_arrendatario, telArrendatario,
      fiador_telefono, telFiador,
      observaciones,
      inventario,
      deposito_tipo, depositoTipo,
      deposito_fechas, depositoFechas,
      metodo_pago, metodoPago,
    } = req.body;

    const final_deposito_tipo = deposito_tipo || depositoTipo || 'ninguno';
    const final_deposito_fechas = deposito_fechas || depositoFechas || [];
    const final_metodo_pago = metodo_pago || metodoPago || 'efectivo';

    const final_nombre = nombre_completo || nombre;
    const final_depto = depto_numero || depto;
    const final_renta_letra = renta_letra || rentaLetra;
    const final_fecha_pago = fecha_pago || fechaPago;
    const final_fecha_inicio = fecha_inicio || fechaInicio;
    const final_fecha_termino = fecha_termino || fechaTermino;
    const final_fiador = fiador_nombre || fiador;
    const final_tel = tel_arrendatario || telArrendatario;
    const final_tel_fiador = fiador_telefono || telFiador;

    if (!final_nombre || !final_depto || !renta || !final_fecha_inicio || !final_fecha_termino) {
      throw new AppError('Nombre, departamento, renta y fechas son requeridos', 400);
    }

    // Verificar que el depto exista y pertenezca al admin
    const deptoCheck = await pool.query(
      `SELECT numero FROM departamentos WHERE admin_id = $1 AND numero = $2`, [req.user!.id, final_depto]
    );
    if (!deptoCheck.rows[0]) throw new AppError(`Departamento ${final_depto} no existe o no te pertenece`, 400);

    const invitation_token = uuidv4();

    const result = await pool.query(
      `INSERT INTO inquilinos (
        admin_id, invitation_token,
        nombre_completo, depto_numero, renta, renta_letra, deposito, fecha_pago,
        fecha_inicio, fecha_termino, fiador_nombre, tel_arrendatario,
        fiador_telefono, observaciones, inventario, deposito_tipo, deposito_fechas,
        metodo_pago
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        req.user!.id,
        invitation_token,
        toTitleCase(final_nombre),
        final_depto,
        renta,
        final_renta_letra ? toTitleCase(final_renta_letra) : null,
        deposito || 0,
        final_fecha_pago,
        final_fecha_inicio,
        final_fecha_termino,
        final_fiador ? toTitleCase(final_fiador) : null,
        final_tel || null,
        final_tel_fiador || null,
        observaciones ? toTitleCase(observaciones) : null,
        JSON.stringify(inventario || []),
        final_deposito_tipo,
        JSON.stringify(final_deposito_fechas),
        final_metodo_pago,
      ]
    );

    // Marcar departamento como ocupado
    await pool.query(
      `UPDATE departamentos SET estado = 'ocupado' WHERE admin_id = $1 AND numero = $2`, [req.user!.id, final_depto]
    );

    // Auditoría
    if ((req as any).audit) {
      await (req as any).audit(result.rows[0].id, null, result.rows[0]);
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/inquilinos/:id
export async function updateInquilino(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Obtener registro anterior para auditoría
    const anterior = await pool.query(`SELECT * FROM inquilinos WHERE admin_id = $1 AND id = $2`, [req.user!.id, id]);
    if (!anterior.rows[0]) throw new AppError('Inquilino no encontrado', 404);

    const current = anterior.rows[0];
    const body = req.body;

    const result = await pool.query(
      `UPDATE inquilinos SET
        nombre_completo   = $1,
        depto_numero      = $2,
        renta             = $3,
        renta_letra       = $4,
        deposito          = $5,
        fecha_pago        = $6,
        fecha_inicio      = $7,
        fecha_termino     = $8,
        fiador_nombre     = $9,
        tel_arrendatario  = $10,
        fiador_telefono   = $11,
        observaciones     = $12,
        inventario        = $13,
        estado            = $14,
        deposito_tipo     = $15,
        deposito_fechas   = $16,
        metodo_pago       = $17
       WHERE admin_id = $18 AND id = $19 RETURNING *`,
      [
        toTitleCase(body.nombre_completo || body.nombre || current.nombre_completo),
        body.depto_numero || body.depto || current.depto_numero,
        body.renta ?? current.renta,
        toTitleCase(body.renta_letra || body.rentaLetra || current.renta_letra),
        body.deposito ?? current.deposito,
        body.fecha_pago || body.fechaPago || current.fecha_pago,
        body.fecha_inicio || body.fechaInicio || current.fecha_inicio,
        body.fecha_termino || body.fechaTermino || current.fecha_termino,
        body.fiador_nombre !== undefined ? toTitleCase(body.fiador_nombre || body.fiador || '') : (body.fiador_nombre === null ? null : current.fiador_nombre),
        body.tel_arrendatario || body.telArrendatario || current.tel_arrendatario,
        body.fiador_telefono || body.telFiador || current.fiador_telefono,
        body.observaciones !== undefined ? toTitleCase(body.observaciones || '') : (body.observaciones === null ? null : current.observaciones),
        body.inventario !== undefined ? JSON.stringify(body.inventario) : current.inventario,
        body.estado ?? current.estado,
        body.deposito_tipo || body.depositoTipo || current.deposito_tipo || 'ninguno',
        JSON.stringify(body.deposito_fechas || body.depositoFechas || current.deposito_fechas || []),
        body.metodo_pago || body.metodoPago || current.metodo_pago || 'efectivo',
        req.user!.id,
        id,
      ]
    );

    // Auditoría
    if ((req as any).audit) {
      await (req as any).audit(id, current, result.rows[0]);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/inquilinos/:id/vincular-usuario
export async function vincularUsuario(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { usuario_id } = req.body;

    const check = await pool.query(`SELECT id FROM inquilinos WHERE admin_id = $1 AND id = $2`, [req.user!.id, id]);
    if (!check.rows[0]) throw new AppError('Inquilino no encontrado', 404);

    const result = await pool.query(
      `UPDATE inquilinos SET usuario_id = $1 WHERE admin_id = $2 AND id = $3 RETURNING id, nombre_completo, usuario_id`,
      [usuario_id || null, req.user!.id, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/inquilinos/:id
export async function deleteInquilino(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const anterior = await pool.query(`SELECT * FROM inquilinos WHERE admin_id = $1 AND id = $2`, [req.user!.id, id]);
    if (!anterior.rows[0]) throw new AppError('Inquilino no encontrado', 404);

    await pool.query(`DELETE FROM inquilinos WHERE admin_id = $1 AND id = $2`, [req.user!.id, id]);

    // Liberar el departamento
    await pool.query(
      `UPDATE departamentos SET estado = 'disponible' WHERE admin_id = $1 AND numero = $2`,
      [req.user!.id, anterior.rows[0].depto_numero]
    );

    if ((req as any).audit) {
      await (req as any).audit(id, anterior.rows[0], null);
    }

    res.json({ success: true, message: 'Inquilino eliminado correctamente' });
  } catch (err) {
    next(err);
  }
}

// GET /api/inquilinos/:id/pdf
export async function getContratoPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await pool.query(`SELECT * FROM inquilinos WHERE admin_id = $1 AND id = $2`, [req.user!.id, id]);
    if (!result.rows[0]) throw new AppError('Inquilino no encontrado', 404);
    const inquilino = result.rows[0];

    const [configRes, deptoRes] = await Promise.all([
      pool.query(`SELECT clave, valor FROM configuracion WHERE admin_id = $1 AND clave IN ('arrendador_nombre', 'arrendador_direccion')`, [req.user!.id]),
      pool.query(`SELECT inventario_base FROM departamentos WHERE admin_id = $1 AND numero = $2`, [req.user!.id, inquilino.depto_numero]),
    ]);

    const config: Record<string, string> = {};
    for (const row of configRes.rows) config[row.clave] = row.valor;

    const data = {
      ...inquilino,
      arrendador_nombre: config['arrendador_nombre'] || 'Administración',
      arrendador_direccion: config['arrendador_direccion'] || inquilino.ubicacion || '',
      inventario_base: deptoRes.rows[0]?.inventario_base || [],
    };

    const pdfBuffer = await PdfService.generateContratoPdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contrato_${inquilino.depto_numero}_${inquilino.nombre_completo.replace(/\s+/g, '_')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
