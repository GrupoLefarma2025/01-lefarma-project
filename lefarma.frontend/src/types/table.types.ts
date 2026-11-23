export type FilterType = 'text' | 'number' | 'boolean' | 'select' | 'date';

export type TextOperator = 'contains' | 'exact' | 'startsWith' | 'endsWith';

export type NumberOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'between';

export type BooleanValue = 'all' | 'true' | 'false';

export interface ColumnFilter {
  columnId: string;
  type: FilterType;
  operator: TextOperator | NumberOperator | BooleanValue;
  value: string | number | boolean | string[] | number[];
  displayLabel: string; 
}

export interface ColumnFilterConfig {
  type: FilterType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  textOperator?: 'contains' | 'exact';
  textCaseSensitive?: boolean;
  numberMin?: number;
  numberMax?: number;
  numberOperator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
  booleanValue?: 'all' | 'true' | 'false';
  dateFrom?: string;
  dateTo?: string;
}

export interface FilterConfig {
  tableId: string;
  searchableColumns: string[]; 
  defaultSearchColumns?: string[]; 
  defaultVisibleColumns?: string[]; 
  requiredColumns?: string[];
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
  onColumnFilterChange?: (columnId: string, config: ColumnFilterConfig) => void;
}

export interface TableConfig {
  tableId: string;
  visibleColumns: string[];
  searchColumns: string[];
  lastFilters?: Record<string, ColumnFilter>;
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
}

export interface UseTableFiltersReturn {
  activeFilters: ColumnFilter[];
  searchColumnIds: string[];
  visibleColumnIds: string[];
  columnFilterConfigs: Record<string, ColumnFilterConfig>;

  addFilter: (filter: ColumnFilter) => void;
  removeFilter: (columnId: string) => void;
  clearAllFilters: () => void;
  setSearchColumns: (columnIds: string[]) => void;
  setVisibleColumns: (columnIds: string[]) => void;
  resetToDefaults: () => void;
  setColumnFilterConfig: (columnId: string, config: ColumnFilterConfig) => void;

  saveConfig: (overrides?: { searchColumns?: string[]; visibleColumns?: string[] }) => void;
  loadConfig: () => void;
}
