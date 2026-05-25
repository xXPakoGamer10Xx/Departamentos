import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// GET /api/config
export async function getConfig(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(`SELECT clave, valor FROM configuracion ORDER BY clave`);
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
    const updates = req.body as Record<string, string>;
    const allowed = [
      'arrendador_nombre', 'arrendador_direccion',
      'banco_nombre', 'banco_clabe', 'banco_titular',
      'admin_invite_code', 'app_url',
    ];

    for (const [clave, valor] of Object.entries(updates)) {
      if (!allowed.includes(clave)) continue;
      await pool.query(
        `INSERT INTO configuracion (clave, valor) VALUES ($1, $2)
         ON CONFLICT (clave) DO UPDATE SET valor = $2, updated_at = NOW()`,
        [clave, valor]
      );
    }
    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (err) {
    next(err);
  }
}
