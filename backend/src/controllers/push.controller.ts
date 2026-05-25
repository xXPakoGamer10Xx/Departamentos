import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

export async function savePushToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, message: 'Token requerido' });
      return;
    }

    await pool.query(`
      INSERT INTO push_tokens (usuario_id, token)
      VALUES ($1, $2)
      ON CONFLICT (usuario_id, token) DO NOTHING
    `, [req.user!.id, token]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
