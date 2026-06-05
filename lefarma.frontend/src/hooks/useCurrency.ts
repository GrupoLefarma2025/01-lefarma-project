import { useConfigStore } from '@/store/configStore';
import { formatCurrency } from '@/utils/currency';

/**
 * Returns a `fmt` function that formats numbers as MXN (Peso Mexicano).
 * Always uses MXN regardless of system configuration or user locale.
 */
export function useCurrency(): { currency: string; fmt: (amount: number, options?: { decimals?: boolean }) => string } {
  const currency = 'MXN';

  return {
    currency,
    fmt: (amount: number, options?: { decimals?: boolean }) =>
      formatCurrency(amount, currency, options),
  };
}
