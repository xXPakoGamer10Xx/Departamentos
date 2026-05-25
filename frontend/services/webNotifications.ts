import { Platform } from 'react-native';

export function requestWebNotificationPermission(): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const N = (window as any).Notification;
  if (N.permission === 'default') N.requestPermission();
}

export function showWebNotification(title: string, body: string): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const N = (window as any).Notification;
  if (N.permission !== 'granted') return;
  try { new N(title, { body }); } catch {}
}
