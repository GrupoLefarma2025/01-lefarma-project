import { useAuthStore } from '@/shared/auth/authStore';

/**
 * Id numérico del usuario de Lefarma.
 *
 * `sigmaAuth` no expone el id (SIGMA no lo necesitaba) y el endpoint de
 * actualización de correo lo exige, así que se lee del store del shell.
 */
export function getUserId(): number | null {
  return useAuthStore.getState().user?.id ?? null;
}
