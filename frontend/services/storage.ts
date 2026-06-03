// Almacenamiento unificado para web y nativo.
//
// En web usa `localStorage` directamente (síncrono).
// En nativo (iOS/Android) usa AsyncStorage, que es asíncrono; para conservar una
// API síncrona en los call sites (que leen el token/usuario durante el render),
// se mantiene un cache en memoria que se precarga una vez al arranque con
// `hydrateStorage()`. Las escrituras actualizan el cache de inmediato y persisten
// en AsyncStorage en segundo plano.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web' && typeof localStorage !== 'undefined';

// Claves que se precargan al iniciar la app para poder leerlas de forma síncrona.
const PRELOAD_KEYS = ['auth_token', 'auth_user', 'notif_enabled'];

// Cache en memoria para lecturas síncronas en nativo.
const cache: Record<string, string | null> = {};

/**
 * Precarga las claves persistidas en el cache en memoria. Debe llamarse una vez
 * al arranque (antes del primer render que dependa de la sesión). No-op en web.
 */
export async function hydrateStorage(): Promise<void> {
  if (isWeb) return;
  try {
    const pairs = await AsyncStorage.multiGet(PRELOAD_KEYS);
    for (const [key, value] of pairs) {
      cache[key] = value;
    }
  } catch {
    // Si la lectura falla, el cache queda vacío y la app arranca en estado deslogueado.
  }
}

export function getItem(key: string): string | null {
  if (isWeb) return localStorage.getItem(key);
  return cache[key] ?? null;
}

export function setItem(key: string, value: string): void {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  cache[key] = value;
  void AsyncStorage.setItem(key, value);
}

export function removeItem(key: string): void {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  cache[key] = null;
  void AsyncStorage.removeItem(key);
}
