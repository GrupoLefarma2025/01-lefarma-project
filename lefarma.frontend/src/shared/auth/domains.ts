/**
 * Catálogo de etiquetas legibles para los dominios de Active Directory
 * soportados por el login. Es config de NEGOCIO, no de presentación:
 * al agregar un dominio nuevo, se modifica este catálogo (no un componente).
 */
export const DOMAIN_NAMES: Record<string, string> = {
  'LEFARMA-HN': 'LeFarma Honduras',
  'LEFARMA-GT': 'LeFarma Guatemala',
  'LEFARMA-SV': 'LeFarma El Salvador',
  'LEFARMA-NI': 'LeFarma Nicaragua',
  'LEFARMA-CR': 'LeFarma Costa Rica',
  DC: 'Distribuidora Central',
};

/** Devuelve la etiqueta legible del dominio, o el código crudo si no existe. */
export function getDomainLabel(domain: string): string {
  return DOMAIN_NAMES[domain] ?? domain;
}
