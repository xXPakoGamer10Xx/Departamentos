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

export async function subscribeWebPush(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ success: false, message: 'Suscripción inválida' });
      return;
    }

    await pool.query(`
      INSERT INTO web_push_subscriptions (usuario_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) DO UPDATE SET usuario_id = $1, p256dh = $3, auth = $4
    `, [req.user!.id, endpoint, keys.p256dh, keys.auth]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
