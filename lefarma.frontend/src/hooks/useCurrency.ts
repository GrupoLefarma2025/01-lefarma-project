import { useConfigStore } from '@/store/configStore';
import { formatCurrency } from '@/utils/currency';

export function useCurrency(): { currency: string; fmt: (amount: number, options?: { decimals?: boolean }) => string } {
  const currency = 'MXN';

  return {
    currency,
    fmt: (amount: number, options?: { decimals?: boolean }) =>
      formatCurrency(amount, currency, options),
  };
}
