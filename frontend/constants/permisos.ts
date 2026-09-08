// Espejo de backend/src/config/permisos.ts — mantener sincronizado.

export type Permiso =
  | 'pagos' | 'pagos.marcar'
  | 'inquilinos' | 'inquilinos.editar'
  | 'departamentos'
  | 'contratos'
  | 'reportes'
  | 'cuentas'
  | 'tickets'
  | 'notificaciones.pagos';

export const PERMISO_LABELS: { key: Permiso; label: string; grupo: string }[] = [
  { key: 'pagos',                label: 'Ver Pagos y Cobranza',                 grupo: 'Pagos' },
  { key: 'pagos.marcar',         label: 'Marcar pagos / registrar abonos',      grupo: 'Pagos' },
  { key: 'inquilinos',           label: 'Ver Inquilinos',                       grupo: 'Inquilinos' },
  { key: 'inquilinos.editar',    label: 'Crear, editar y dar de baja inquilinos', grupo: 'Inquilinos' },
  { key: 'departamentos',        label: 'Ver Departamentos',                    grupo: 'Propiedad' },
  { key: 'contratos',            label: 'Ver y generar Contratos',              grupo: 'Propiedad' },
  { key: 'reportes',             label: 'Ver Reportes e ingresos',              grupo: 'Reportes' },
  { key: 'cuentas',              label: 'Ver Cuentas bancarias',                grupo: 'Reportes' },
  { key: 'tickets',              label: 'Ver y atender Tickets',                grupo: 'Otros' },
  { key: 'notificaciones.pagos', label: 'Recibir notificaciones de pagos',      grupo: 'Otros' },
];

export const PRESETS: { key: string; label: string; descripcion: string; permisos: Permiso[] }[] = [
  {
    key: 'cobrador',
    label: 'Cobrador',
    descripcion: 'Registra pagos y recibe avisos de cobranza.',
    permisos: ['pagos', 'pagos.marcar', 'inquilinos', 'notificaciones.pagos'],
  },
  {
    key: 'contador',
    label: 'Contador',
    descripcion: 'Ve pagos, reportes y cuentas — solo lectura.',
    permisos: ['pagos', 'reportes', 'cuentas', 'inquilinos', 'departamentos'],
  },
  {
    key: 'asistente',
    label: 'Asistente',
    descripcion: 'Administra inquilinos, departamentos y contratos.',
    permisos: ['inquilinos', 'inquilinos.editar', 'departamentos', 'contratos', 'tickets'],
  },
];

// ── Estado de permisos del usuario en sesión ────────────────────────────────
let _rol: string | null = null;
let _permisos: Permiso[] = [];

export function setSesionPermisos(rol: string | null, permisos: unknown) {
  _rol = rol;
  _permisos = Array.isArray(permisos) ? (permisos as Permiso[]) : [];
}

/** El admin puede todo. El colaborador solo si tiene el permiso. */
export function can(key: Permiso): boolean {
  if (_rol === 'admin') return true;
  if (_rol !== 'cobrador') return false;
  return _permisos.includes(key);
}

export function esAdmin(): boolean {
  return _rol === 'admin';
}
