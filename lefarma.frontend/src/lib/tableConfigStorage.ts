import type { TableConfig } from '@/types/table.types';


const STORAGE_KEY = 'table-configs';

declare global {
  interface Window {
    clearTableConfigs?: () => void;
  }
}

/**
 * Obtener todas las configuraciones de tablas desde localStorage
 */
export function getAllConfigs(): TableConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as TableConfig[]) : [];
  } catch (error) {
    console.error('[tableConfigStorage] Error reading configs:', error);
    return [];
  }
}

/**
 * Obtener la configuración de una tabla específica
 */
export function getConfig(tableId: string): TableConfig | null {
  const configs = getAllConfigs();
  return configs.find(c => c.tableId === tableId) || null;
}

/**
 * Guardar la configuración de una tabla específica
 * Crea una entrada nueva si no existe, actualiza si ya existe
 */
export function saveConfig(config: TableConfig): void {
  try {
    const configs = getAllConfigs();
    const existingIndex = configs.findIndex(c => c.tableId === config.tableId);

    if (existingIndex >= 0) {
      configs[existingIndex] = config;
    } else {
      configs.push(config);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('[tableConfigStorage] Error saving config:', error);
  }
}

/**
 * Resetear la configuración de una tabla específica a los valores por defecto
 */
export function resetConfig(tableId: string): void {
  try {
    const configs = getAllConfigs();
    const filtered = configs.filter(c => c.tableId !== tableId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[tableConfigStorage] Error resetting config:', error);
  }
}

/**
 * Limpiar TODAS las configuraciones de tablas de localStorage
 */
export function clearAllConfigs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Configs limpiadas exitosamente
  } catch (error) {
    console.error('[tableConfigStorage] Error clearing configs:', error);
  }
}

/**
 * Exponer función en el objeto global window para acceso desde la consola
 */
if (typeof window !== 'undefined') {
  window.clearTableConfigs = clearAllConfigs;
}

export function createDefaultConfig(
  tableId: string,
  allColumnIds: string[],
  defaultSearchColumns: string[] = [],
  defaultVisibleColumns?: string[]
): TableConfig {
  return {
    tableId,
    visibleColumns: defaultVisibleColumns ?? allColumnIds,
    searchColumns: defaultSearchColumns.length > 0 ? defaultSearchColumns : allColumnIds,
    lastFilters: {},
  };
}
