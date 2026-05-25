import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendPush, getAdminPushTokens, getUserPushTokens, createAndSendNotification } from '../services/push.service';
import { emitToAdmins, emitToUser } from '../services/sse.service';

function getCurrentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// GET /api/tickets — admin: todos; inquilino: los suyos
export async function getTickets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let query: string;
    let params: any[];

    if (req.user!.rol === 'admin') {
      const { estado, mes } = req.query as { estado?: string; mes?: string };

      if (mes) {
        // Historial: todos los tickets del mes indicado (YYYY-MM)
        const [anio, mesNum] = mes.split('-');
        let sql = `
          SELECT t.*,
            i.nombre_completo as inquilino_nombre,
            i.depto_numero,
            u.nombre_completo as atendido_por_nombre
          FROM tickets t
          JOIN inquilinos i ON i.id = t.inquilino_id
          LEFT JOIN usuarios u ON u.id = t.atendido_por
          WHERE i.admin_id = $1
            AND DATE_PART('year', t.created_at) = $2
            AND DATE_PART('month', t.created_at) = $3
        `;
        params = [req.user!.id, anio, mesNum];
        if (estado) {
          sql += ` AND t.estado = $4`;
          params.push(estado);
        }
        sql += ` ORDER BY t.created_at DESC`;
        query = sql;
      } else {
        let sql = `
          SELECT t.*,
            i.nombre_completo as inquilino_nombre,
            i.depto_numero,
            u.nombre_completo as atendido_por_nombre
          FROM tickets t
          JOIN inquilinos i ON i.id = t.inquilino_id
          LEFT JOIN usuarios u ON u.id = t.atendido_por
          WHERE i.admin_id = $1
        `;
        params = [req.user!.id];
        if (estado) {
          sql += ` AND t.estado = $2`;
          params.push(estado);
        }
        sql += `
          ORDER BY
            CASE t.estado WHEN 'abierto' THEN 0 WHEN 'en_revision' THEN 1 ELSE 2 END,
            t.created_at DESC
        `;
        query = sql;
      }
    } else {
      // Inquilino: buscar su depto vinculado
      const inqRes = await pool.query(
        `SELECT id FROM inquilinos WHERE usuario_id = $1 AND estado = 'activo' LIMIT 1`,
        [req.user!.id]
      );
      if (!inqRes.rows[0]) {
        res.json({ success: true, data: [] });
        return;
      }
      query = `
        SELECT t.* FROM tickets t
        WHERE t.inquilino_id = $1
        ORDER BY t.created_at DESC
      `;
      params = [inqRes.rows[0].id];
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/tickets — cualquier usuario autenticado puede crear (inquilino o admin)
export async function createTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { titulo, descripcion, inquilino_id } = req.body;

    if (!titulo?.trim() || !descripcion?.trim()) {
      throw new AppError('Título y descripción son requeridos', 400);
    }

    let inqId = inquilino_id;

    if (req.user!.rol === 'inquilino') {
      const inqRes = await pool.query(
        `SELECT id FROM inquilinos WHERE usuario_id = $1 AND estado = 'activo' LIMIT 1`,
        [req.user!.id]
      );
      if (!inqRes.rows[0]) throw new AppError('Tu cuenta no está vinculada a ningún departamento', 403);
      inqId = inqRes.rows[0].id;
    } else {
      const inqRes = await pool.query(
        `SELECT id FROM inquilinos WHERE id = $1 AND admin_id = $2`,
        [inqId, req.user!.id]
      );
      if (!inqRes.rows[0]) throw new AppError('Inquilino no encontrado o no autorizado', 403);
    }

    if (!inqId) throw new AppError('inquilino_id es requerido', 400);

    const result = await pool.query(
      `INSERT INTO tickets (inquilino_id, titulo, descripcion, creado_por)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [inqId, titulo.trim(), descripcion.trim(), req.user!.id]
    );

    const ticket = result.rows[0];
    res.status(201).json({ success: true, data: ticket });

    // Notificar al admin en tiempo real (SSE + push)
    pool.query(
      `SELECT t.*, i.nombre_completo as inquilino_nombre, i.depto_numero, i.admin_id
       FROM tickets t JOIN inquilinos i ON i.id = t.inquilino_id WHERE t.id = $1`,
      [ticket.id]
    ).then(async enriched => {
      const full = enriched.rows[0];
      if (full.admin_id) {
         emitToUser(full.admin_id, 'ticket_new', { ticket: full });
         createAndSendNotification(full.admin_id, '🔔 Nuevo ticket', `${full.titulo} — Depto ${full.depto_numero}`, 'ticket');
      }
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tickets/:id — admin actualiza estado y/o nota
export async function updateTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { estado, nota_admin } = req.body;

    const check = await pool.query(
      `SELECT t.id FROM tickets t JOIN inquilinos i ON i.id = t.inquilino_id WHERE t.id = $1 AND i.admin_id = $2`, 
      [id, req.user!.id]
    );
    if (!check.rows[0]) throw new AppError('Ticket no encontrado o no autorizado', 404);

    const result = await pool.query(
      `UPDATE tickets SET
        estado       = COALESCE($1, estado),
        nota_admin   = COALESCE($2, nota_admin),
        atendido_por = CASE WHEN $1 IS NOT NULL THEN $3 ELSE atendido_por END,
        updated_at   = NOW()
       WHERE id = $4 RETURNING *`,
      [estado || null, nota_admin !== undefined ? nota_admin : null, req.user!.id, id]
    );

    const updated = result.rows[0];
    res.json({ success: true, data: updated });

    // Notificar al inquilino en tiempo real (SSE + push) y actualizar lista del admin
    emitToUser(req.user!.id, 'ticket_updated', { ticket: updated });
    pool.query(
      `SELECT i.usuario_id FROM inquilinos i
       JOIN tickets t ON t.inquilino_id = i.id WHERE t.id = $1`, [id]
    ).then(async inqRes => {
      const usuarioId = inqRes.rows[0]?.usuario_id;
      if (usuarioId) {
        emitToUser(usuarioId, 'ticket_updated', { ticket: updated });
        const label = estado === 'en_revision' ? 'en revisión' : estado === 'resuelto' ? 'resuelto' : 'actualizado';
        return createAndSendNotification(usuarioId, '📋 Ticket actualizado', `Tu reporte fue marcado como ${label}`, 'ticket');
      }
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tickets/:id — admin: cualquiera; inquilino: solo los suyos en los primeros 5 min
export async function deleteTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (req.user!.rol === 'admin') {
      const result = await pool.query(
        `DELETE FROM tickets t USING inquilinos i WHERE t.id = $1 AND t.inquilino_id = i.id AND i.admin_id = $2 RETURNING t.id`, 
        [id, req.user!.id]
      );
      if (!result.rows[0]) throw new AppError('Ticket no encontrado o no autorizado', 404);
      res.json({ success: true });
      return;
    }

    const inqRes = await pool.query(
      `SELECT id FROM inquilinos WHERE usuario_id = $1 AND estado = 'activo' LIMIT 1`,
      [req.user!.id]
    );
    if (!inqRes.rows[0]) throw new AppError('No autorizado', 403);

    const result = await pool.query(
      `DELETE FROM tickets
       WHERE id = $1 AND inquilino_id = $2 AND created_at > NOW() - INTERVAL '5 minutes'
       RETURNING id`,
      [id, inqRes.rows[0].id]
    );
    if (!result.rows[0]) throw new AppError('No puedes eliminar este ticket (ya pasaron 5 minutos o no es tuyo)', 403);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
