import { useAuthStore } from "@/shared/auth/authStore";
import { sigmaAuth } from "@/apps/sigma/store/sigmaAuth";

export const auth = {
  isAuthenticated(): boolean {
    return Boolean(sigmaAuth.getToken());
  },
  getToken(): string | null {
    return sigmaAuth.getToken();
  },
  getUser(): string | null {
    return sigmaAuth.getUser()?.nombreCompleto ?? null;
  },
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
