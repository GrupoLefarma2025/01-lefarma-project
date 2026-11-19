import { useAuthStore } from "@/shared/auth/authStore";
import { sigmaAuth } from "@/apps/sigma/store/sigmaAuth";

/**
 * Helpers de sesión para las páginas portadas de SIGMA. Antes vivían en
 * `~/lib/auth` del proyecto original (sesión OIDC propia); aquí se apoyan en
 * el store de autenticación de Lefarma (`sigmaAuth`) para no duplicarlo.
 */
export const auth = {
  isAuthenticated(): boolean {
    return Boolean(sigmaAuth.getToken());
  },
  getToken(): string | null {
    return sigmaAuth.getToken();
  },
  /** Nombre para mostrar del usuario. */
  getUser(): string | null {
    return sigmaAuth.getUser()?.nombreCompleto ?? null;
  },
  /** `usuario@dominio`, tal y como lo guardan los documentos. */
  getUserWithDomain(): string | null {
    const user = sigmaAuth.getUser();
    if (!user) return null;
    return user.dominio ? `${user.username}@${user.dominio}` : user.username;
  },
  getFullUser() {
    return sigmaAuth.getUser();
  },
  hasPermission(code: string): boolean {
    return sigmaAuth.hasPermission(code);
  },
  getPermissions(): string[] {
    return sigmaAuth.getUser()?.permisos ?? [];
  },
  logout(): void {
    void useAuthStore.getState().logout();
  },
};
