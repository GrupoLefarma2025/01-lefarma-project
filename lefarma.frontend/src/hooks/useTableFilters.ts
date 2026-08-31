import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  ColumnFilter,
  ColumnFilterConfig,
  FilterConfig,
  TableConfig,
  UseTableFiltersReturn,
} from '@/types/table.types';
import {
  getConfig,
  saveConfig as saveConfigToStorage,
  resetConfig as resetConfigInStorage,
  createDefaultConfig,
} from '@/lib/tableConfigStorage';


export function useTableFilters<TData>({
  tableId,
  allColumns,
  defaultSearchColumns = [],
  defaultVisibleColumns,
  columnFilterConfigs: initialColumnFilterConfigs = {},
}: {
  tableId: string;
  allColumns: ColumnDef<TData>[];
  defaultSearchColumns?: string[];
  defaultVisibleColumns?: string[];
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
}): UseTableFiltersReturn {
  // Extraer IDs de columna de las definiciones de columnas
  // Usar useMemo para evitar recálculo en cada render (buena práctica de Vercel)
  const allColumnIds = useMemo(() =>
    allColumns
      .map(col => col.id || (('accessorKey' in col && typeof col.accessorKey === 'string') ? col.accessorKey : '') || '')
      .filter(id => id !== null && id !== undefined && id !== ''),
    [allColumns]
  );

  // Estado
  const [activeFilters, setActiveFilters] = useState<ColumnFilter[]>([]);
  const [searchColumnIds, setSearchColumnIds] = useState<string[]>(defaultSearchColumns);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(
    defaultVisibleColumns ?? allColumnIds
  );
  const [columnFilterConfigs, setColumnFilterConfigs] = useState<Record<string, ColumnFilterConfig>>(initialColumnFilterConfigs);

  // Trackear inicialización para prevenir race condition de auto-save
  const isInitialized = useRef(false);
  const isLoadingConfig = useRef(false);

  // Mantener un ref al valor actual de allColumnIds para evitar problemas de stale closure
  const allColumnIdsRef = useRef(allColumnIds);
  useEffect(() => {
    allColumnIdsRef.current = allColumnIds;
  }, [allColumnIds]);

  // Cargar config al montar y cuando cambian las columnas
  // Solo cargar cuando allColumnIds tiene valores (no vacío)
  useEffect(() => {
    // Esperar hasta que allColumnIds esté poblado
    if (allColumnIds.length === 0) {
      return;
    }

    isLoadingConfig.current = true;
    loadConfig();
    // Usar setTimeout para poner el flag en false después de que se procesen todas las actualizaciones de state
    setTimeout(() => {
      isLoadingConfig.current = false;
      isInitialized.current = true;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, allColumnIds]);

  // Acciones
  const addFilter = useCallback((filter: ColumnFilter) => {
    setActiveFilters(prev => {
      // Remover filtro existente para la misma columna
      const filtered = prev.filter(f => f.columnId !== filter.columnId);
      return [...filtered, filter];
    });
  }, []);

  const removeFilter = useCallback((columnId: string) => {
    setActiveFilters(prev => prev.filter(f => f.columnId !== columnId));
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const setSearchColumns = useCallback((columnIds: string[]) => {
    setSearchColumnIds(columnIds);
  }, []);

  const setVisibleColumns = useCallback((columnIds: string[]) => {
    setVisibleColumnIds(columnIds);
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = createDefaultConfig(tableId, allColumnIds, defaultSearchColumns, defaultVisibleColumns);
    setActiveFilters([]);
    setSearchColumnIds(defaults.searchColumns);
    setVisibleColumnIds(defaults.visibleColumns);
    setColumnFilterConfigs({});

    saveConfigToStorage(defaults);
  }, [tableId, allColumnIds, defaultSearchColumns, defaultVisibleColumns, saveConfigToStorage]);

  const setColumnFilterConfig = useCallback((columnId: string, config: ColumnFilterConfig) => {
    setColumnFilterConfigs(prev => ({
      ...prev,
      [columnId]: config,
    }));
  }, []);

  // Persistencia
  const saveConfig = useCallback((overrides?: { searchColumns?: string[]; visibleColumns?: string[] }) => {
    // Usar ref para obtener el valor actual
    const currentAllColumnIds = allColumnIdsRef.current;

    const config: TableConfig = {
      tableId,
      visibleColumns: overrides?.visibleColumns ?? visibleColumnIds, // Usar override si se proporciona, si no usar state
      searchColumns: overrides?.searchColumns ?? searchColumnIds,
      lastFilters: activeFilters.reduce((acc, filter) => {
        acc[filter.columnId] = filter;
        return acc;
      }, {} as Record<string, ColumnFilter>),
      columnFilterConfigs,
    };
    saveConfigToStorage(config);
  }, [tableId, searchColumnIds, visibleColumnIds, activeFilters, columnFilterConfigs]);

  const loadConfig = useCallback(() => {
    const saved = getConfig(tableId);
    // IMPORTANTE: Leer el valor ACTUAL del ref para evitar stale closure
    const currentAllColumnIds = allColumnIdsRef.current;

    if (!currentAllColumnIds || currentAllColumnIds.length === 0) {
      return;
    }

    if (saved) {
      // Cargar searchColumns desde localStorage (respeta selección del usuario)
      const cleanSearchColumns = saved.searchColumns.filter(id => id && currentAllColumnIds.includes(id));
      setSearchColumnIds(cleanSearchColumns);

      if (saved.lastFilters) {
        setActiveFilters(Object.values(saved.lastFilters));
      }
      if (saved.columnFilterConfigs) {
        setColumnFilterConfigs(saved.columnFilterConfigs);
      }

      // Cargar visibleColumns desde localStorage (respeta selección del usuario)
      // Si está vacío o falta, por defecto son todas las columnas
      const savedVisible = saved.visibleColumns && saved.visibleColumns.length > 0
        ? saved.visibleColumns.filter(id => currentAllColumnIds.includes(id))
        : currentAllColumnIds;
      setVisibleColumnIds(savedVisible);
    } else {
      const defaults = createDefaultConfig(tableId, currentAllColumnIds, defaultSearchColumns, defaultVisibleColumns);
      setSearchColumnIds(defaults.searchColumns);
      setVisibleColumnIds(defaults.visibleColumns);
      saveConfigToStorage(defaults);
    }
  }, [tableId, defaultSearchColumns, defaultVisibleColumns, saveConfigToStorage]);

  // Auto-save cuando cambia el state (solo después de inicialización, no durante load)
  useEffect(() => {
    if (isInitialized.current && !isLoadingConfig.current) {
      saveConfig();
    }
  }, [activeFilters, searchColumnIds, visibleColumnIds, saveConfig]);

  return {
    activeFilters,
    searchColumnIds,
    visibleColumnIds,
    addFilter,
    removeFilter,
    clearAllFilters,
    setSearchColumns,
    setVisibleColumns,
    resetToDefaults,
    setColumnFilterConfig,
    columnFilterConfigs,
    saveConfig,
    loadConfig,
  };
}
