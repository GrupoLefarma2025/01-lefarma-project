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
  columnFilterConfigs: initialColumnFilterConfigs = {},
}: {
  tableId: string;
  allColumns: ColumnDef<TData>[];
  defaultSearchColumns?: string[];
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
}): UseTableFiltersReturn {
  // Extract column IDs from column definitions
  // Use useMemo to prevent recalculation on every render (Vercel best practice)
  const allColumnIds = useMemo(() =>
    allColumns
      .map(col => col.id || (('accessorKey' in col && typeof col.accessorKey === 'string') ? col.accessorKey : '') || '')
      .filter(id => id !== null && id !== undefined && id !== ''),
    [allColumns]
  );

  // State
  const [activeFilters, setActiveFilters] = useState<ColumnFilter[]>([]);
  const [searchColumnIds, setSearchColumnIds] = useState<string[]>(defaultSearchColumns);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(allColumnIds); // Initialize with ALL columns
  const [columnFilterConfigs, setColumnFilterConfigs] = useState<Record<string, ColumnFilterConfig>>(initialColumnFilterConfigs);

  // Track initialization to prevent auto-save race condition
  const isInitialized = useRef(false);
  const isLoadingConfig = useRef(false);

  // Keep a ref to the current value of allColumnIds to avoid stale closure issues
  const allColumnIdsRef = useRef(allColumnIds);
  useEffect(() => {
    allColumnIdsRef.current = allColumnIds;
  }, [allColumnIds]);

  // Load config on mount and when columns change
  // Only load when allColumnIds has values (not empty)
  useEffect(() => {
    // Wait until allColumnIds is populated
    if (allColumnIds.length === 0) {
      return;
    }

    isLoadingConfig.current = true;
    loadConfig();
    // Use setTimeout to set flag false after all state updates are processed
    setTimeout(() => {
      isLoadingConfig.current = false;
      isInitialized.current = true;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, allColumnIds]);

  // Actions
  const addFilter = useCallback((filter: ColumnFilter) => {
    setActiveFilters(prev => {
      // Remove existing filter for same column
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
    const defaults = createDefaultConfig(tableId, allColumnIds, defaultSearchColumns);
    setActiveFilters([]);
    setSearchColumnIds(defaults.searchColumns);
    setVisibleColumnIds(defaults.visibleColumns); // This is allColumnIds
    setColumnFilterConfigs({});

    // Save the default config immediately so it persists
    saveConfigToStorage(defaults);
  }, [tableId, allColumnIds, defaultSearchColumns, saveConfigToStorage]);

  const setColumnFilterConfig = useCallback((columnId: string, config: ColumnFilterConfig) => {
    setColumnFilterConfigs(prev => ({
      ...prev,
      [columnId]: config,
    }));
  }, []);

  // Persistence
  const saveConfig = useCallback((overrides?: { searchColumns?: string[]; visibleColumns?: string[] }) => {
    // Use ref to get current value
    const currentAllColumnIds = allColumnIdsRef.current;

    const config: TableConfig = {
      tableId,
      visibleColumns: overrides?.visibleColumns ?? visibleColumnIds, // Use override if provided, else use state
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
    // IMPORTANT: Read the CURRENT value from the ref to avoid stale closure
    const currentAllColumnIds = allColumnIdsRef.current;

    if (!currentAllColumnIds || currentAllColumnIds.length === 0) {
      return;
    }

    if (saved) {
      // Load searchColumns from localStorage (respect user's selection)
      const cleanSearchColumns = saved.searchColumns.filter(id => id && currentAllColumnIds.includes(id));
      setSearchColumnIds(cleanSearchColumns);

      if (saved.lastFilters) {
        setActiveFilters(Object.values(saved.lastFilters));
      }
      if (saved.columnFilterConfigs) {
        setColumnFilterConfigs(saved.columnFilterConfigs);
      }

      // Load visibleColumns from localStorage (respect user's selection)
      // If empty or missing, default to all columns
      const savedVisible = saved.visibleColumns && saved.visibleColumns.length > 0
        ? saved.visibleColumns.filter(id => currentAllColumnIds.includes(id))
        : currentAllColumnIds;
      setVisibleColumnIds(savedVisible);
    } else {
      // Create default config on first visit - ALL columns visible
      const defaults = createDefaultConfig(tableId, currentAllColumnIds, defaultSearchColumns);
      setSearchColumnIds(defaults.searchColumns);
      setVisibleColumnIds(defaults.visibleColumns);
      saveConfigToStorage(defaults);
    }
  }, [tableId, defaultSearchColumns, saveConfigToStorage]);

  // Auto-save when state changes (only after initialization, not during load)
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
