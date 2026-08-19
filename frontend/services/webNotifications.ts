import { Platform } from 'react-native';

export function showWebNotification(title: string, body: string): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const N = (window as any).Notification;
  if (N.permission !== 'granted') return;
  try { new N(title, { body }); } catch {}
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Notificaciones push reales del navegador (Service Worker + Push API): a
// diferencia de `showWebNotification`, estas llegan a la barra de notificaciones
// del sistema aunque la pestaña/navegador esté cerrado.
//
// IMPORTANTE: Notification.requestPermission() solo debe llamarse en respuesta
// a un gesto explícito del usuario (un tap/click). Si se llama automáticamente
// al cargar la página, Chrome (sobre todo en Android) lo trata como spam y
// puede DENEGAR el permiso permanentemente sin mostrar ningún diálogo — y ya
// denegado, el navegador nunca vuelve a preguntar. Por eso esta lógica está
// partida en dos funciones.

async function subscribeAndSend(vapidPublicKey: string): Promise<boolean> {
  const registration = await navigator.serviceWorker.register('/sw.js');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  const sub = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return false;

  const api = (await import('./api')).default;
  await api.subscribeWebPush({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return true;
}

// Llamar automáticamente al montar la app (layouts). NUNCA pide permiso — solo
// restaura la suscripción si el usuario ya lo había concedido antes.
export async function resubscribeWebPushIfGranted(): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return;

  const N = (window as any).Notification;
  if (!N || N.permission !== 'granted') return;

  try {
    await subscribeAndSend(vapidPublicKey);
  } catch {
    // Web Push no disponible en este navegador/entorno — el polling/SSE cubre
    // las actualizaciones mientras la pestaña esté abierta.
  }
}

// Llamar SOLO desde un manejador de evento de usuario (ej. onValueChange de un
// switch). Pide permiso si hace falta y, si se concede, crea la suscripción.
// Devuelve true si quedaron activadas.
export async function activateWebPush(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return false;

  const N = (window as any).Notification;
  if (!N) return false;

  try {
    if (N.permission === 'default') await N.requestPermission();
    if (N.permission !== 'granted') return false;
    return await subscribeAndSend(vapidPublicKey);
  } catch {
    return false;
  }
}
