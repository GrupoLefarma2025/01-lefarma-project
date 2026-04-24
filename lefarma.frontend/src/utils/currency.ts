/**
 * Maps internal currency codes to ISO 4217 codes and their natural locale.
 * Some systems use local abbreviations (e.g. "LPS" for Honduran Lempira) that
 * differ from the official ISO code ("HNL"). This map bridges that gap.
 */
const CURRENCY_MAP: Record<string, { locale: string; isoCode: string }> = {
  MXN: { locale: 'es-MX', isoCode: 'MXN' },
  USD: { locale: 'en-US', isoCode: 'USD' },
  EUR: { locale: 'es-ES', isoCode: 'EUR' },
  HNL: { locale: 'es-HN', isoCode: 'HNL' },
  LPS: { locale: 'es-HN', isoCode: 'HNL' }, // local alias for HNL
  GTQ: { locale: 'es-GT', isoCode: 'GTQ' },
  CRC: { locale: 'es-CR', isoCode: 'CRC' },
};

/**
 * Format a number as a currency string using the appropriate locale and symbol.
 * Falls back to the provided code as ISO code if not found in the map.
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'MXN',
  options?: { decimals?: boolean }
): string {
  const mapping = CURRENCY_MAP[currencyCode.toUpperCase()] ?? {
    locale: 'es-MX',
    isoCode: currencyCode,
  };

  return new Intl.NumberFormat(mapping.locale, {
    style: 'currency',
    currency: mapping.isoCode,
    minimumFractionDigits: options?.decimals ? 2 : 0,
    maximumFractionDigits: options?.decimals ? 2 : 0,
  }).format(amount);
}
