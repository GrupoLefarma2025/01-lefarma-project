import { useConfigStore } from '@/store/configStore';
import { formatCurrency } from '@/utils/currency';

/**
 * Retorna una función `fmt` que formatea números como MXN (Peso Mexicano).
 * Siempre usa MXN sin importar la configuración del sistema o el locale del usuario.
 */
export function useCurrency(): { currency: string; fmt: (amount: number, options?: { decimals?: boolean }) => string } {
  const currency = 'MXN';

  return {
    currency,
    fmt: (amount: number, options?: { decimals?: boolean }) =>
      formatCurrency(amount, currency, options),
  };
}
