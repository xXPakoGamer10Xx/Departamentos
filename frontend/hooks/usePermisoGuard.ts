import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { can, esAdmin, type Permiso } from '../constants/permisos';

/**
 * Redirige al Dashboard si el usuario en sesión no tiene el permiso indicado.
 * El admin siempre pasa. Devuelve `true` si tiene acceso.
 */
export function usePermisoGuard(permiso: Permiso): boolean {
  const router = useRouter();
  const ok = can(permiso);
  useEffect(() => {
    if (!ok) router.replace('/(admin)' as any);
  }, [ok]);
  return ok;
}

/** Redirige al Dashboard si el usuario no es administrador. */
export function useAdminGuard(): boolean {
  const router = useRouter();
  const ok = esAdmin();
  useEffect(() => {
    if (!ok) router.replace('/(admin)' as any);
  }, [ok]);
  return ok;
}
