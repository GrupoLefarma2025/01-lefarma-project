import { useConfigStore } from '@/store/configStore';
import { formatCurrency } from '@/utils/currency';

/**
 * Returns a `fmt` function that formats numbers as currency using the
 * system's configured default currency (from globalConfig.defaultCurrency).
 */
export function useCurrency() {
  const currency = useConfigStore((s) => s.globalConfig.defaultCurrency);

  return {
    currency,
    fmt: (amount: number, options?: { decimals?: boolean }) =>
      formatCurrency(amount, currency, options),
  };
}
