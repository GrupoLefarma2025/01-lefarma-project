import type { TableConfig } from '@/types/table.types';


const STORAGE_KEY = 'table-configs';

declare global {
  interface Window {
    clearTableConfigs?: () => void;
  }
}

/**
 * Get all table configs from localStorage
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
 * Get config for a specific table
 */
export function getConfig(tableId: string): TableConfig | null {
  const configs = getAllConfigs();
  return configs.find(c => c.tableId === tableId) || null;
}

/**
 * Save config for a specific table
 * Creates new entry if doesn't exist, updates if it does
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
 * Reset config for a specific table to defaults
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
 * Clear ALL table configs from localStorage
 */
export function clearAllConfigs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Configs cleared successfully
  } catch (error) {
    console.error('[tableConfigStorage] Error clearing configs:', error);
  }
}

/**
 * Expose function to global window object for console access
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
