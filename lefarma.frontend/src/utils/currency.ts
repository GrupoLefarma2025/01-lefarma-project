const CURRENCY_MAP: Record<string, { locale: string; isoCode: string }> = {
  MXN: { locale: 'es-MX', isoCode: 'MXN' },
  USD: { locale: 'en-US', isoCode: 'USD' },
  EUR: { locale: 'es-ES', isoCode: 'EUR' },
  HNL: { locale: 'es-HN', isoCode: 'HNL' },
  LPS: { locale: 'es-HN', isoCode: 'HNL' }, 
  GTQ: { locale: 'es-GT', isoCode: 'GTQ' },
  CRC: { locale: 'es-CR', isoCode: 'CRC' },
};

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
