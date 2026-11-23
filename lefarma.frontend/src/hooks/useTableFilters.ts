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
  requiredColumns = [],
  columnFilterConfigs: initialColumnFilterConfigs = {},
}: {
  tableId: string;
  allColumns: ColumnDef<TData>[];
  defaultSearchColumns?: string[];
  defaultVisibleColumns?: string[];
  requiredColumns?: string[];
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
}): UseTableFiltersReturn {
  const allColumnIds = useMemo(() =>
    allColumns
      .map(col => col.id || (('accessorKey' in col && typeof col.accessorKey === 'string') ? col.accessorKey : '') || '')
      .filter(id => id !== null && id !== undefined && id !== ''),
    [allColumns]
  );

  const requiredColumnKey = requiredColumns.join('|');

  const [activeFilters, setActiveFilters] = useState<ColumnFilter[]>([]);
  const [searchColumnIds, setSearchColumnIds] = useState<string[]>(defaultSearchColumns);
  const [visiblesGuardadas, setVisibleColumnIds] = useState<string[]>(
    defaultVisibleColumns ?? allColumnIds
  );
  const [columnFilterConfigs, setColumnFilterConfigs] = useState<Record<string, ColumnFilterConfig>>(initialColumnFilterConfigs);

  const visibleColumnIds = useMemo(() => {
    const requeridas = requiredColumnKey
      .split('|')
      .filter(id => id !== '' && allColumnIds.includes(id));
    if (requeridas.length === 0) return visiblesGuardadas;
    const presentes = new Set(visiblesGuardadas);
    const faltantes = requeridas.filter(id => !presentes.has(id));
    return faltantes.length === 0 ? visiblesGuardadas : [...faltantes, ...visiblesGuardadas];
  }, [visiblesGuardadas, requiredColumnKey, allColumnIds]);

  const isInitialized = useRef(false);
  const isLoadingConfig = useRef(false);

  const allColumnIdsRef = useRef(allColumnIds);
  useEffect(() => {
    allColumnIdsRef.current = allColumnIds;
  }, [allColumnIds]);

  useEffect(() => {
    if (allColumnIds.length === 0) {
      return;
    }

    isLoadingConfig.current = true;
    loadConfig();
    setTimeout(() => {
      isLoadingConfig.current = false;
      isInitialized.current = true;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, allColumnIds]);

  const addFilter = useCallback((filter: ColumnFilter) => {
    setActiveFilters(prev => {
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

  const saveConfig = useCallback((overrides?: { searchColumns?: string[]; visibleColumns?: string[] }) => {
    const currentAllColumnIds = allColumnIdsRef.current;

    const config: TableConfig = {
      tableId,
      visibleColumns: overrides?.visibleColumns ?? visibleColumnIds, 
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
    const currentAllColumnIds = allColumnIdsRef.current;

    if (!currentAllColumnIds || currentAllColumnIds.length === 0) {
      return;
    }

    if (saved) {
      const cleanSearchColumns = saved.searchColumns.filter(id => id && currentAllColumnIds.includes(id));
      setSearchColumnIds(cleanSearchColumns);

      if (saved.lastFilters) {
        setActiveFilters(Object.values(saved.lastFilters));
      }
      if (saved.columnFilterConfigs) {
        setColumnFilterConfigs(saved.columnFilterConfigs);
      }

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
