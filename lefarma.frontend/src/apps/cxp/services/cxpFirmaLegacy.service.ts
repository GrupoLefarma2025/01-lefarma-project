/**
 * Contrato legacy exclusivo de CxP (columna firma_path).
 * No usa firma_control ni firma_path_cifrada: las firmas ya cargadas
 * se sirven como URL pública bajo /media/archivos y el reemplazo es libre.
 */
export const cxpFirmaLegacyEndpoints = {
  profile: '/profile',
  check: '/profile/firma-legacy/check',
  upload: '/profile/firma-legacy',
  remove: '/profile/firma-legacy',
} as const;

/**
 * Construye la URL pública legacy de una firma (ej. "firmas_usuarios/70.png").
 * VITE_API_URL ya incluye /api, por lo que apunta a /api/media/archivos,
 * servido por UseStaticFiles en Program.cs (igual que el componente original).
 */
export function getCxpFirmaLegacyUrl(firmaPath: string | null | undefined): string | null {
  if (!firmaPath) return null;
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
  return `${apiUrl}/media/archivos/${firmaPath}`;
}
