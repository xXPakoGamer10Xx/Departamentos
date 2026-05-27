import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// GET /api/config
export async function getConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let adminId = req.user!.id;

    if (req.user!.rol === 'inquilino') {
      const inq = await pool.query(`SELECT admin_id FROM inquilinos WHERE usuario_id = $1 AND estado = 'activo' LIMIT 1`, [req.user!.id]);
      if (inq.rows[0]) {
        adminId = inq.rows[0].admin_id;
      } else {
        // Si no tiene inquilino activo, regresamos vacío
        res.json({ success: true, data: {} });
        return;
      }
    }

    const result = await pool.query(`SELECT clave, valor FROM configuracion WHERE admin_id = $1 ORDER BY clave`, [adminId]);
    const config: Record<string, string> = {};
    for (const row of result.rows) {
      config[row.clave] = row.valor;
    }
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}

// PUT /api/config
export async function updateConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.rol !== 'admin') {
      throw new AppError('No autorizado', 403);
    }

    const adminId = req.user!.id;
    const updates = req.body as Record<string, string>;
    const allowed = [
      'arrendador_nombre', 'arrendador_direccion',
      'banco_nombre', 'banco_clabe', 'banco_titular',
      'admin_invite_code', 'app_url',
      'contrato_docx_template', 'contrato_docx_nombre',
    ];

    for (const [clave, valor] of Object.entries(updates)) {
      if (!allowed.includes(clave)) continue;
      await pool.query(
        `INSERT INTO configuracion (admin_id, clave, valor) VALUES ($1, $2, $3)
         ON CONFLICT (admin_id, clave) DO UPDATE SET valor = $3, updated_at = NOW()`,
        [adminId, clave, valor]
      );
    }
    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/config/contrato-template
export async function deleteContratoTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.rol !== 'admin') throw new AppError('No autorizado', 403);
    await pool.query(
      `DELETE FROM configuracion WHERE admin_id = $1 AND clave IN ('contrato_docx_template', 'contrato_docx_nombre')`,
      [req.user!.id]
    );
    res.json({ success: true, message: 'Plantilla eliminada — se usará la plantilla por defecto' });
  } catch (err) {
    next(err);
  }
}
