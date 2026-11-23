export const cxpFirmaLegacyEndpoints = {
  profile: '/profile',
  check: '/profile/firma-legacy/check',
  upload: '/profile/firma-legacy',
  remove: '/profile/firma-legacy',
} as const;

export function getCxpFirmaLegacyUrl(firmaPath: string | null | undefined): string | null {
  if (!firmaPath) return null;
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
  return `${apiUrl}/media/archivos/${firmaPath}`;
}
