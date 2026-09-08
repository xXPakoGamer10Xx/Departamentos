import { AuthRequest } from '../middleware/auth.middleware';

// Id del administrador dueño de los datos para la petición actual.
// - admin  → su propio id
// - cobrador/inquilino → el admin al que pertenecen (viene en el JWT como admin_id)
// En un despliegue de un solo admin, si por alguna razón no viene admin_id,
// cae en el propio id (comportamiento previo).
export function ownerId(req: AuthRequest): string {
  if (req.user?.rol === 'admin') return req.user.id;
  return (req.user as any)?.admin_id || req.user!.id;
}

// Id del usuario REAL que hace la petición (para campos "creado_por", auditoría, etc.).
// Para un colaborador `req.user.id` fue reescrito al del admin, así que aquí se usa actorId.
export function actorId(req: AuthRequest): string {
  return req.user?.actorId ?? req.user!.id;
}
