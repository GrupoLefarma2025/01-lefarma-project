/**
 * Tipos de filtro soportados según el tipo de dato de la columna
 */
export type FilterType = 'text' | 'number' | 'boolean' | 'select' | 'date';

/**
 * Operadores para filtros de texto
 */
export type TextOperator = 'contains' | 'exact' | 'startsWith' | 'endsWith';

/**
 * Operadores para filtros numéricos
 */
export type NumberOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'between';

/**
 * Valores para filtros booleanos
 */
export type BooleanValue = 'all' | 'true' | 'false';

/**
 * Filtro activo en una columna
 */
export interface ColumnFilter {
  columnId: string;
  type: FilterType;
  operator: TextOperator | NumberOperator | BooleanValue;
  value: string | number | boolean | string[] | number[];
  displayLabel: string; // Etiqueta legible para badges
}

/**
 * Configuración del comportamiento de filtro de una sola columna
 */
export interface ColumnFilterConfig {
  type: FilterType;
  // Para tipo 'select' - opciones disponibles
  options?: { value: string; label: string }[];
  // Para tipo 'number' - valores min/max
  min?: number;
  max?: number;
  // Ajustes extendidos de filtro (usados en el panel FilterConfig)
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
 * Configuración pasada a DataTable para filtros
 */
export interface FilterConfig {
  tableId: string;
  searchableColumns: string[]; // Todas las columnas que PUEDEN ser buscadas
  defaultSearchColumns?: string[]; // Columnas por defecto a buscar (subconjunto de searchableColumns)
  defaultVisibleColumns?: string[]; // Columnas visibles por defecto (subconjunto de todas las columnas)
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
  onColumnFilterChange?: (columnId: string, config: ColumnFilterConfig) => void;
}

/**
 * Configuración completa de tabla almacenada en localStorage
 */
export interface TableConfig {
  tableId: string;
  visibleColumns: string[];
  searchColumns: string[];
  lastFilters?: Record<string, ColumnFilter>;
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
}

/**
 * Estado retornado por el hook useTableFilters
 */
export interface UseTableFiltersReturn {
  // Estado
  activeFilters: ColumnFilter[];
  searchColumnIds: string[];
  visibleColumnIds: string[];
  columnFilterConfigs: Record<string, ColumnFilterConfig>;

  // Acciones
  addFilter: (filter: ColumnFilter) => void;
  removeFilter: (columnId: string) => void;
  clearAllFilters: () => void;
  setSearchColumns: (columnIds: string[]) => void;
  setVisibleColumns: (columnIds: string[]) => void;
  resetToDefaults: () => void;
  setColumnFilterConfig: (columnId: string, config: ColumnFilterConfig) => void;

  // Persistencia
  saveConfig: (overrides?: { searchColumns?: string[]; visibleColumns?: string[] }) => void;
  loadConfig: () => void;
}
