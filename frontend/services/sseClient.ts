import { Platform } from 'react-native';

type Listener = (data: any) => void;

let es: any = null;
let reconnectTimer: any = null;
let currentToken = '';
let currentBase = '';

const listeners = new Map<string, Set<Listener>>();

export function connectSSE(token: string, baseUrl: string): void {
  if (Platform.OS !== 'web' || es) return;
  currentToken = token;
  currentBase = baseUrl;
  openConnection();
}

function openConnection(): void {
  const apiBase = currentBase.endsWith('/api') ? currentBase.slice(0, -4) : currentBase;
  const url = `${apiBase}/api/events?token=${encodeURIComponent(currentToken)}`;

  try {
    es = new (window as any).EventSource(url);
  } catch {
    return;
  }

  es.onopen = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  es.onerror = () => {
    es?.close();
    es = null;
    reconnectTimer = setTimeout(openConnection, 4000);
  };

  const events = ['ticket_new', 'ticket_updated', 'payment_confirmed', 'payment_rejected', 'comprobante_subido'];
  for (const evt of events) {
    es.addEventListener(evt, (e: any) => {
      try { dispatch(evt, JSON.parse(e.data)); } catch {}
    });
  }
}

export function disconnectSSE(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  es?.close();
  es = null;
}

function dispatch(event: string, data: any): void {
  listeners.get(event)?.forEach(cb => { try { cb(data); } catch {} });
}

export function onSSEEvent(event: string, cb: Listener): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(cb);
  return () => listeners.get(event)?.delete(cb);
}
