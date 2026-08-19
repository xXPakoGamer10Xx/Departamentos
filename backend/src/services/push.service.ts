import webpush from 'web-push';
import { pool } from '../config/database';
import { emitToUser } from './sse.service';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:soporte@vertexrent.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function getUserPushTokens(usuarioId: string): Promise<string[]> {
  const res = await pool.query('SELECT token FROM push_tokens WHERE usuario_id = $1', [usuarioId]);
  return res.rows.map(r => r.token);
}

export async function getUserWebPushSubscriptions(usuarioId: string): Promise<WebPushSubscription[]> {
  const res = await pool.query(
    'SELECT endpoint, p256dh, auth FROM web_push_subscriptions WHERE usuario_id = $1',
    [usuarioId]
  );
  return res.rows;
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
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const json: any = await res.json().catch(() => null);
    const tickets = json?.data;

    if (!res.ok || !Array.isArray(tickets)) {
      console.error('[push] Expo rechazó el envío:', res.status, JSON.stringify(json));
      return;
    }

    // Expo responde 200 aunque un ticket individual haya fallado (credenciales
    // FCM/APNs faltantes, token expirado, etc.) — hay que revisar cada uno.
    const invalidTokens: string[] = [];
    tickets.forEach((ticket: any, i: number) => {
      if (ticket.status === 'error') {
        console.error(`[push] Error al enviar a ${valid[i]}: ${ticket.message}`, ticket.details || '');
        if (ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(valid[i]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await pool.query('DELETE FROM push_tokens WHERE token = ANY($1)', [invalidTokens]);
    }
  } catch (err) {
    console.error('[push] Fallo de red al contactar a Expo:', err);
  }
}

export async function sendWebPush(
  subscriptions: WebPushSubscription[],
  title: string,
  body: string,
  data?: object
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[web-push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no configuradas — no se puede enviar');
    return;
  }
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({ title, body, data: data || {} });
  const staleEndpoints: string[] = [];

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err: any) {
      // 404/410 = el navegador invalidó la suscripción (desinstaló, limpió datos, etc.)
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      } else {
        console.error(`[web-push] Error al enviar a ${sub.endpoint}:`, err?.statusCode, err?.body || err?.message);
      }
    }
  }));

  if (staleEndpoints.length > 0) {
    await pool.query('DELETE FROM web_push_subscriptions WHERE endpoint = ANY($1)', [staleEndpoints]);
  }
}

export async function createAndSendNotification(
  usuarioId: string,
  title: string,
  body: string,
  tipo: 'renta' | 'cuota' | 'ticket' | 'pago' | 'promesa'
): Promise<void> {
  try {
    // 1. Guardar en base de datos para la web y panel histórico
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo)
       VALUES ($1, $2, $3, $4)`,
      [usuarioId, title, body, tipo]
    );

    // 2. Emitir por Server-Sent Events (SSE) si está conectado en Web
    emitToUser(usuarioId, 'notification_new', { title, mensaje: body, tipo });

    // 3. Enviar Push Notification por Expo a móviles (app nativa)
    const tokens = await getUserPushTokens(usuarioId);
    if (tokens.length > 0) {
      await sendPush(tokens, title, body, { tipo });
    }

    // 4. Enviar Web Push al navegador (funciona con la pestaña/navegador cerrado)
    const webSubs = await getUserWebPushSubscriptions(usuarioId);
    if (webSubs.length > 0) {
      await sendWebPush(webSubs, title, body, { tipo });
    }
  } catch (err) {
    console.error('Error al guardar/enviar notificación:', err);
  }
}
