import type { ColumnDef } from '@tanstack/react-table';


/**
 * Supported filter types based on column data type
 */
export type FilterType = 'text' | 'number' | 'boolean' | 'select' | 'date';

/**
 * Operators for text filters
 */
export type TextOperator = 'contains' | 'exact' | 'startsWith' | 'endsWith';

/**
 * Operators for number filters
 */
export type NumberOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'between';

/**
 * Values for boolean filters
 */
export type BooleanValue = 'all' | 'true' | 'false';

/**
 * Active filter on a column
 */
export interface ColumnFilter {
  columnId: string;
  type: FilterType;
  operator: TextOperator | NumberOperator | BooleanValue;
  value: string | number | boolean | string[] | number[];
  displayLabel: string; // Human-readable label for badges
}

/**
 * Configuration for a single column's filter behavior
 */
export interface ColumnFilterConfig {
  type: FilterType;
  // For 'select' type - available options
  options?: { value: string; label: string }[];
  // For 'number' type - min/max values
  min?: number;
  max?: number;
  // Extended filter settings (used in FilterConfig panel)
  textOperator?: 'contains' | 'exact';
  textCaseSensitive?: boolean;
  numberMin?: number;
  numberMax?: number;
  numberOperator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
  booleanValue?: 'all' | 'true' | 'false';
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Configuration passed to DataTable for filters
 */
export interface FilterConfig<TData> {
  tableId: string;
  searchableColumns: string[]; // All columns that CAN be searched
  defaultSearchColumns?: string[]; // Default columns to search (subset of searchableColumns)
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
  onColumnFilterChange?: (columnId: string, config: ColumnFilterConfig) => void;
}

/**
 * Complete table configuration stored in localStorage
 */
export interface TableConfig {
  tableId: string;
  visibleColumns: string[];
  searchColumns: string[];
  lastFilters?: Record<string, ColumnFilter>;
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
}

/**
 * State returned by useTableFilters hook
 */
export interface UseTableFiltersReturn {
  // State
  activeFilters: ColumnFilter[];
  searchColumnIds: string[];
  visibleColumnIds: string[];
  columnFilterConfigs: Record<string, ColumnFilterConfig>;

  // Actions
  addFilter: (filter: ColumnFilter) => void;
  removeFilter: (columnId: string) => void;
  clearAllFilters: () => void;
  setSearchColumns: (columnIds: string[]) => void;
  setVisibleColumns: (columnIds: string[]) => void;
  resetToDefaults: () => void;
  setColumnFilterConfig: (columnId: string, config: ColumnFilterConfig) => void;

  // Persistence
  saveConfig: (overrides?: { searchColumns?: string[]; visibleColumns?: string[] }) => void;
  loadConfig: () => void;
}
