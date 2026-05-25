/**
 * Convierte texto a "Title Case" con soporte a español.
 * "TRES MIL PESOS" → "Tres Mil Pesos"
 * "DEPOSITO EN 2 QUINCENAS" → "Depósito En 2 Quincenas"
 */
export function toTitleCase(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formatea un número como moneda mexicana.
 * 3500 → "$3,500.00"
 */
export function toMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

/**
 * Formatea una fecha ISO a formato legible en español.
 * "2026-01-30" → "30 de enero de 2026"
 */
export function toDateES(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate + 'T12:00:00Z'); // Evitar problemas de zona horaria
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
}

/**
 * Normaliza un número de teléfono a 10 dígitos.
 * "55 6132 1234" → "5561321234"
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Sanitiza un objeto eliminando campos undefined/null vacíos.
 */
export function sanitizeObject<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>;
}
