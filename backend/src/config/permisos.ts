// Catálogo de permisos para usuarios colaboradores (rol 'cobrador').
// El admin siempre tiene todo; el inquilino usa su propio portal.

export const PERMISOS = [
  'pagos',                 // ver el apartado de Pagos y Cobranza
  'pagos.marcar',          // marcar pagos como pagados / registrar abonos / cancelar
  'inquilinos',            // ver inquilinos
  'inquilinos.editar',     // crear, editar y dar de baja inquilinos
  'departamentos',         // ver departamentos
  'contratos',             // ver y generar contratos
  'reportes',              // ver reportes e ingresos
  'cuentas',               // ver cuentas bancarias
  'tickets',               // ver y atender tickets
  'notificaciones.pagos',  // recibir notificaciones de pagos y vencimientos
] as const;

export type Permiso = typeof PERMISOS[number];

export const PRESETS: Record<string, { label: string; descripcion: string; permisos: Permiso[] }> = {
  cobrador: {
    label: 'Cobrador',
    descripcion: 'Registra pagos y recibe avisos de cobranza.',
    permisos: ['pagos', 'pagos.marcar', 'inquilinos', 'notificaciones.pagos'],
  },
  contador: {
    label: 'Contador',
    descripcion: 'Ve pagos, reportes y cuentas — solo lectura.',
    permisos: ['pagos', 'reportes', 'cuentas', 'inquilinos', 'departamentos'],
  },
  asistente: {
    label: 'Asistente',
    descripcion: 'Administra inquilinos, departamentos y contratos.',
    permisos: ['inquilinos', 'inquilinos.editar', 'departamentos', 'contratos', 'tickets'],
  },
};

export function sanitizePermisos(input: unknown): Permiso[] {
  if (!Array.isArray(input)) return [];
  const set = new Set(PERMISOS as readonly string[]);
  return [...new Set(input.filter((p): p is Permiso => typeof p === 'string' && set.has(p)))];
}
