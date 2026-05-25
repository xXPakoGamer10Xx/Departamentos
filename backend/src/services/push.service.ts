import { pool } from '../config/database';

export async function getUserPushTokens(usuarioId: string): Promise<string[]> {
  const res = await pool.query('SELECT token FROM push_tokens WHERE usuario_id = $1', [usuarioId]);
  return res.rows.map(r => r.token);
}

export async function getAdminPushTokens(): Promise<string[]> {
  const res = await pool.query(`
    SELECT pt.token FROM push_tokens pt
    JOIN usuarios u ON u.id = pt.usuario_id
    WHERE u.rol = 'admin' AND u.activo = true
  `);
  return res.rows.map(r => r.token);
}

export async function sendPush(tokens: string[], title: string, body: string, data?: object): Promise<void> {
  const valid = tokens.filter(t => t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;

  const messages = valid.map(to => ({ to, title, body, data: data || {}, sound: 'default' }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    // Fire-and-forget — never block the main operation
  }
}
