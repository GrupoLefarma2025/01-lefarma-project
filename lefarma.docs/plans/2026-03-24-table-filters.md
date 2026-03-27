# Table Filters and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable filter and search system for 11 catalog tables with per-column filters, configurable global search, and localStorage persistence.

**Architecture:** Extend existing DataTable component with optional filterConfig. New components (FilterConfig panel, ActiveFiltersBar, ColumnFilterPopover) integrate with TanStack Table's built-in filtering. useTableFilters hook manages state and localStorage persistence. All components are optional - no breaking changes.

**Tech Stack:** React 19, TypeScript, TanStack Table v8, Zustand, localStorage, shadcn/ui components

---

## File Structure

```
src/
├── types/
│   └── table.types.ts                    [NEW] Type definitions for filtering
├── lib/
│   └── tableConfigStorage.ts             [NEW] localStorage utilities
├── hooks/
│   └── useTableFilters.ts                [NEW] Main filter logic hook
├── components/
│   ├── table/
│   │   ├── ColumnFilterPopover.tsx       [NEW] Per-column filter popover
│   │   ├── ActiveFiltersBar.tsx          [NEW] Bar with filter badges
│   │   └── FilterConfig.tsx              [NEW] Settings panel (⚙️)
│   └── ui/
│       └── data-table.tsx                [MODIFY] Add filterConfig prop
└── pages/
    └── catalogos/
        └── generales/
            └── Empresas/
                └── EmpresasList.tsx      [MODIFY] Add filterConfig (PoC #1)
            └── Proveedores/
                └── ProveedoresList.tsx  [MODIFY] Add filterConfig (PoC #2)
```

---

## Task 1: Type Definitions

**Files:**
- Create: `lefarma.frontend/src/types/table.types.ts`

Create type definitions for the filter system. These types will be used across all components.

- [ ] **Step 1: Create the types file**

```typescript
// lefarma.frontend/src/types/table.types.ts

import type { ColumnDef } from '@tanstack/react-table';

/**
 * Supported filter types based on column data type
 */
export type FilterType = 'text' | 'number' | 'boolean' | 'select';

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
  value: string | number | boolean | string[];
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
}

/**
 * Configuration passed to DataTable for filters
 */
export interface FilterConfig<TData> {
  tableId: string;
  searchableColumns: string[]; // All columns that CAN be searched
  defaultSearchColumns?: string[]; // Default columns to search (subset of searchableColumns)
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
}

/**
 * Complete table configuration stored in localStorage
 */
export interface TableConfig {
  tableId: string;
  visibleColumns: string[];
  searchColumns: string[];
  lastFilters?: Record<string, ColumnFilter>;
}

/**
 * State returned by useTableFilters hook
 */
export interface UseTableFiltersReturn {
  // State
  activeFilters: ColumnFilter[];
  searchColumnIds: string[];
  visibleColumnIds: string[];

  // Actions
  addFilter: (filter: ColumnFilter) => void;
  removeFilter: (columnId: string) => void;
  clearAllFilters: () => void;
  setSearchColumns: (columnIds: string[]) => void;
  setVisibleColumns: (columnIds: string[]) => void;
  resetToDefaults: () => void;

  // Persistence
  saveConfig: () => void;
  loadConfig: () => void;
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/types/table.types.ts
git commit -m "feat(types): add table filter system type definitions"
```

---

## Task 2: localStorage Utilities

**Files:**
- Create: `lefarma.frontend/src/lib/tableConfigStorage.ts`

Create utilities for reading/writing table configuration from localStorage.

- [ ] **Step 1: Create localStorage utilities**

```typescript
// lefarma.frontend/src/lib/tableConfigStorage.ts

import type { TableConfig } from '@/types/table.types';

const STORAGE_KEY = 'table-configs';

/**
 * Get all table configs from localStorage
 */
export function getAllConfigs(): TableConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
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
 * Create default config for a table
 */
export function createDefaultConfig(
  tableId: string,
  allColumnIds: string[],
  defaultSearchColumns: string[] = []
): TableConfig {
  return {
    tableId,
    visibleColumns: allColumnIds,
    searchColumns: defaultSearchColumns.length > 0 ? defaultSearchColumns : allColumnIds,
    lastFilters: {},
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/lib/tableConfigStorage.ts
git commit -m "feat(lib): add table config localStorage utilities"
```

---

## Task 3: useTableFilters Hook

**Files:**
- Create: `lefarma.frontend/src/hooks/useTableFilters.ts`

Create the main hook that manages filter state and integrates with localStorage.

- [ ] **Step 1: Create the hook**

```typescript
// lefarma.frontend/src/hooks/useTableFilters.ts

import { useState, useCallback, useEffect } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  ColumnFilter,
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
  searchableColumns = [],
}: {
  tableId: string;
  allColumns: ColumnDef<TData>[];
  defaultSearchColumns?: string[];
  searchableColumns: string[];
}): UseTableFiltersReturn {
  // Extract column IDs from column definitions
  const allColumnIds = allColumns.map(col => col.id || col.accessorKey as string);

  // State
  const [activeFilters, setActiveFilters] = useState<ColumnFilter[]>([]);
  const [searchColumnIds, setSearchColumnIds] = useState<string[]>(defaultSearchColumns);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(allColumnIds);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [tableId]);

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
    setVisibleColumnIds(defaults.visibleColumns);
    resetConfigInStorage(tableId);
  }, [tableId, allColumnIds, defaultSearchColumns]);

  // Persistence
  const saveConfig = useCallback(() => {
    const config: TableConfig = {
      tableId,
      visibleColumns: visibleColumnIds,
      searchColumns: searchColumnIds,
      lastFilters: activeFilters.reduce((acc, filter) => {
        acc[filter.columnId] = filter;
        return acc;
      }, {} as Record<string, ColumnFilter>),
    };
    saveConfigToStorage(config);
  }, [tableId, visibleColumnIds, searchColumnIds, activeFilters]);

  const loadConfig = useCallback(() => {
    const saved = getConfig(tableId);
    if (saved) {
      setSearchColumnIds(saved.searchColumns);
      setVisibleColumnIds(saved.visibleColumns);
      if (saved.lastFilters) {
        setActiveFilters(Object.values(saved.lastFilters));
      }
    } else {
      // Create default config on first visit
      const defaults = createDefaultConfig(tableId, allColumnIds, defaultSearchColumns);
      setSearchColumnIds(defaults.searchColumns);
      setVisibleColumnIds(defaults.visibleColumns);
      saveConfigToStorage(defaults);
    }
  }, [tableId, allColumnIds, defaultSearchColumns]);

  // Auto-save when state changes
  useEffect(() => {
    saveConfig();
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
    saveConfig,
    loadConfig,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/hooks/useTableFilters.ts
git commit -m "feat(hooks): add useTableFilters hook for filter state management"
```

---

## Task 4: ColumnFilterPopover Component

**Files:**
- Create: `lefarma.frontend/src/components/table/ColumnFilterPopover.tsx`

Create the popover that appears when clicking the filter icon in column headers.

- [ ] **Step 1: Create the filter popover component**

```typescript
// lefarma.frontend/src/components/table/ColumnFilterPopover.tsx

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import type { ColumnFilter, FilterType, TextOperator, NumberOperator, BooleanValue } from '@/types/table.types';

interface ColumnFilterPopoverProps {
  columnId: string;
  columnName: string;
  filterType: FilterType;
  hasActiveFilter: boolean;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  selectOptions?: { value: string; label: string }[];
}

export function ColumnFilterPopover({
  columnId,
  columnName,
  filterType,
  hasActiveFilter,
  onApplyFilter,
  onClearFilter,
  selectOptions = [],
}: ColumnFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  if (filterType === 'text') {
    return <TextFilterPopover {...{ columnId, columnName, hasActiveFilter, onApplyFilter, onClearFilter, open, setOpen }} />;
  }

  if (filterType === 'number') {
    return <NumberFilterPopover {...{ columnId, columnName, hasActiveFilter, onApplyFilter, onClearFilter, open, setOpen }} />;
  }

  if (filterType === 'boolean') {
    return <BooleanFilterPopover {...{ columnId, columnName, hasActiveFilter, onApplyFilter, onClearFilter, open, setOpen }} />;
  }

  if (filterType === 'select') {
    return <SelectFilterPopover {...{ columnId, columnName, hasActiveFilter, onApplyFilter, onClearFilter, selectOptions, open, setOpen }} />;
  }

  return null;
}

// Text Filter
function TextFilterPopover({
  columnId,
  columnName,
  hasActiveFilter,
  onApplyFilter,
  onClearFilter,
  open,
  setOpen,
}: {
  columnId: string;
  columnName: string;
  hasActiveFilter: boolean;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [operator, setOperator] = useState<TextOperator>('contains');
  const [value, setValue] = useState('');

  const handleApply = () => {
    if (!value.trim()) return;
    onApplyFilter({
      columnId,
      type: 'text',
      operator,
      value,
      displayLabel: `${columnName} ${operator} "${value}"`,
    });
    setOpen(false);
    setValue('');
  };

  const handleClear = () => {
    onClearFilter();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filtro: {columnName}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Operador</Label>
            <Select value={operator} onValueChange={(v) => setOperator(v as TextOperator)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">contiene</SelectItem>
                <SelectItem value="exact">exacta</SelectItem>
                <SelectItem value="startsWith">empieza con</SelectItem>
                <SelectItem value="endsWith">termina con</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              placeholder="Ingrese valor..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            />
          </div>

          <div className="flex justify-between">
            {hasActiveFilter && (
              <Button variant="outline" size="sm" onClick={handleClear}>
                Limpiar
              </Button>
            )}
            <Button size="sm" onClick={handleApply} disabled={!value.trim()}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Boolean Filter
function BooleanFilterPopover({
  columnId,
  columnName,
  hasActiveFilter,
  onApplyFilter,
  onClearFilter,
  open,
  setOpen,
}: {
  columnId: string;
  columnName: string;
  hasActiveFilter: boolean;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [value, setValue] = useState<BooleanValue>('all');

  const handleApply = () => {
    if (value === 'all') {
      onClearFilter();
    } else {
      onApplyFilter({
        columnId,
        type: 'boolean',
        operator: value,
        value: value === 'true',
        displayLabel: `${columnName} = ${value === 'true' ? 'Activo' : 'Inactivo'}`,
      });
    }
    setOpen(false);
    setValue('all');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filtro: {columnName}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <RadioGroup value={value} onValueChange={(v) => setValue(v as BooleanValue)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">Todos</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="true" />
              <Label htmlFor="true">Activo</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="false" />
              <Label htmlFor="false">Inactivo</Label>
            </div>
          </RadioGroup>

          <Button size="sm" className="w-full" onClick={handleApply}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Number Filter
function NumberFilterPopover({
  columnId,
  columnName,
  hasActiveFilter,
  onApplyFilter,
  onClearFilter,
  open,
  setOpen,
}: {
  columnId: string;
  columnName: string;
  hasActiveFilter: boolean;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [operator, setOperator] = useState<NumberOperator>('equals');
  const [value, setValue] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  const handleApply = () => {
    if (operator === 'between') {
      const min = parseFloat(minValue);
      const max = parseFloat(maxValue);
      if (isNaN(min) || isNaN(max)) return;
      onApplyFilter({
        columnId,
        type: 'number',
        operator,
        value: [min, max],
        displayLabel: `${columnName} entre ${min} y ${max}`,
      });
      setMinValue('');
      setMaxValue('');
    } else {
      const num = parseFloat(value);
      if (isNaN(num)) return;
      onApplyFilter({
        columnId,
        type: 'number',
        operator,
        value: num,
        displayLabel: `${columnName} ${getOperatorSymbol(operator)} ${num}`,
      });
      setValue('');
    }
    setOpen(false);
  };

  const getOperatorSymbol = (op: NumberOperator) => {
    switch (op) {
      case 'equals': return '=';
      case 'notEquals': return '≠';
      case 'greaterThan': return '>';
      case 'lessThan': return '<';
      case 'between': return 'entre';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filtro: {columnName}</span>
          </div>

          <Select value={operator} onValueChange={(v) => setOperator(v as NumberOperator)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">=</SelectItem>
              <SelectItem value="notEquals">≠</SelectItem>
              <SelectItem value="greaterThan">&gt;</SelectItem>
              <SelectItem value="lessThan">&lt;</SelectItem>
              <SelectItem value="between">entre</SelectItem>
            </SelectContent>
          </Select>

          {operator === 'between' ? (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Mínimo..."
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Máximo..."
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
              />
            </div>
          ) : (
            <Input
              type="number"
              placeholder="Valor..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}

          <Button size="sm" className="w-full" onClick={handleApply} disabled={!value && (!minValue || !maxValue)}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Select Multi Filter
function SelectFilterPopover({
  columnId,
  columnName,
  hasActiveFilter,
  onApplyFilter,
  onClearFilter,
  selectOptions,
  open,
  setOpen,
}: {
  columnId: string;
  columnName: string;
  hasActiveFilter: boolean;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  selectOptions: { value: string; label: string }[];
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const handleToggle = (value: string) => {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleApply = () => {
    if (selected.length === 0) {
      onClearFilter();
    } else {
      const labels = selectOptions
        .filter(opt => selected.includes(opt.value))
        .map(opt => opt.label)
        .join(', ');
      onApplyFilter({
        columnId,
        type: 'select',
        operator: 'contains',
        value: selected,
        displayLabel: `${columnName} ∈ {${labels}}`,
      });
    }
    setOpen(false);
    setSelected([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filtro: {columnName}</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectOptions.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={option.value}
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => handleToggle(option.value)}
                />
                <Label htmlFor={option.value} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            {hasActiveFilter && (
              <Button variant="outline" size="sm" onClick={onClearFilter}>
                Limpiar
              </Button>
            )}
            <Button size="sm" onClick={handleApply}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/components/table/ColumnFilterPopover.tsx
git commit -m "feat(table): add ColumnFilterPopover component for per-column filters"
```

---

## Task 5: ActiveFiltersBar Component

**Files:**
- Create: `lefarma.frontend/src/components/table/ActiveFiltersBar.tsx`

Create the bar that displays active filters as badges with remove buttons.

- [ ] **Step 1: Create the filters bar component**

```typescript
// lefarma.frontend/src/components/table/ActiveFiltersBar.tsx

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ColumnFilter } from '@/types/table.types';

interface ActiveFiltersBarProps {
  filters: ColumnFilter[];
  onRemoveFilter: (columnId: string) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({ filters, onRemoveFilter, onClearAll }: ActiveFiltersBarProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {filters.map(filter => (
        <Badge key={filter.columnId} variant="secondary" className="gap-1 pr-1">
          {filter.displayLabel}
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => onRemoveFilter(filter.columnId)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      {filters.length > 1 && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearAll}>
          Limpiar todos
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/components/table/ActiveFiltersBar.tsx
git commit -m "feat(table): add ActiveFiltersBar component for displaying active filters"
```

---

## Task 6: FilterConfig Component (⚙️ Panel)

**Files:**
- Create: `lefarma.frontend/src/components/table/FilterConfig.tsx`

Create the settings panel with checkboxes for search columns and visible columns.

- [ ] **Step 1: Create the filter config panel**

```typescript
// lefarma.frontend/src/components/table/FilterConfig.tsx

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings2 } from 'lucide-react';

interface FilterConfigProps {
  tableId: string;
  allColumns: { id: string; header: string }[];
  searchableColumns: string[];
  visibleColumns: string[];
  onSearchColumnsChange: (columnIds: string[]) => void;
  onVisibleColumnsChange: (columnIds: string[]) => void;
  onReset: () => void;
}

export function FilterConfig({
  tableId,
  allColumns,
  searchableColumns,
  visibleColumns,
  onSearchColumnsChange,
  onVisibleColumnsChange,
  onReset,
}: FilterConfigProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Configurar tabla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar tabla: {tableId}</DialogTitle>
          <DialogDescription>
            Selecciona las columnas para búsqueda y visibilidad. La configuración se guarda automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-4">
          {/* Search Columns */}
          <div className="space-y-3">
            <h3 className="font-medium">Buscar en estas columnas</h3>
            <p className="text-xs text-muted-foreground">
              El buscador general buscará en las columnas seleccionadas
            </p>
            <div className="space-y-2">
              {allColumns.map(column => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`search-${column.id}`}
                    checked={searchableColumns.includes(column.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSearchColumnsChange([...searchableColumns, column.id]);
                      } else {
                        onSearchColumnsChange(searchableColumns.filter(id => id !== column.id));
                      }
                    }}
                  />
                  <Label htmlFor={`search-${column.id}`} className="text-sm">
                    {column.header}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Visible Columns */}
          <div className="space-y-3">
            <h3 className="font-medium">Columnas visibles</h3>
            <p className="text-xs text-muted-foreground">
              Selecciona las columnas que quieres mostrar en la tabla
            </p>
            <div className="space-y-2">
              {allColumns.map(column => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`visible-${column.id}`}
                    checked={visibleColumns.includes(column.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onVisibleColumnsChange([...visibleColumns, column.id]);
                      } else {
                        onVisibleColumnsChange(visibleColumns.filter(id => id !== column.id));
                      }
                    }}
                  />
                  <Label htmlFor={`visible-${column.id}`} className="text-sm">
                    {column.header}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onReset}>
            Restaurar defaults
          </Button>
          <Button onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/components/table/FilterConfig.tsx
git commit -m "feat(table): add FilterConfig panel component for table configuration"
```

---

## Task 7: Extend DataTable Component

**Files:**
- Modify: `lefarma.frontend/src/components/ui/data-table.tsx`

Extend the existing DataTable to integrate all filter components when filterConfig is provided.

- [ ] **Step 1: Read current data-table.tsx structure**

Read lines 1-100 to understand:
- Current props interface (DataTableProps)
- Where column definitions are used
- Where header rendering happens
- Current imports at top of file

- [ ] **Step 2: Add imports at top of file**

After line 39 (existing imports), add:

```typescript
import { useTableFilters } from '@/hooks/useTableFilters';
import { FilterConfig } from '@/components/table/FilterConfig';
import { ActiveFiltersBar } from '@/components/table/ActiveFiltersBar';
import { ColumnFilterPopover } from '@/components/table/ColumnFilterPopover';
import type { FilterConfig as FilterConfigType } from '@/types/table.types';
```

- [ ] **Step 3: Extend DataTableProps interface**

After line 71 (after `onRowClick?: (row: TData) => void;`), add:

```typescript
  // Filter configuration
  filterConfig?: FilterConfigType<TData>;
```

- [ ] **Step 4: Add filter logic in DataTable component body**

After line 100 (after `const table = useReactTable({...})`), add:

```typescript
  // Filter logic
  const filterEnabled = !!filterConfig;
  const {
    activeFilters,
    visibleColumnIds,
    addFilter,
    removeFilter,
    clearAllFilters,
    setSearchColumnIds,
    setVisibleColumnIds,
    resetToDefaults,
  } = useTableFilters({
    tableId: filterConfig?.tableId || '',
    allColumns: columns,
    defaultSearchColumns: filterConfig?.defaultSearchColumns,
    searchableColumns: filterConfig?.searchableColumns || [],
  });

  // Convert activeFilters to TanStack Table format
  const columnFilters = useMemo(() => {
    return activeFilters.map(filter => ({
      id: filter.columnId,
      value: filter.value,
    }));
  }, [activeFilters]);

  // Pass columnFilters to useReactTable
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters, // Add this
    },
    // ... rest of existing options
  });
```

- [ ] **Step 5: Add filter icon to column headers**

Modify the header rendering section (around line 250-280) to add filter icon:

Find the SortIcon rendering and add after it:

```typescript
{filterConfig && filterConfig.searchableColumns.includes(column.id) && (
  <ColumnFilterPopover
    columnId={column.id}
    columnName={String(column.header)}
    filterType={getFilterTypeForColumn(column.id)}
    hasActiveFilter={activeFilters.some(f => f.columnId === column.id)}
    onApplyFilter={addFilter}
    onClearFilter={() => removeFilter(column.id)}
  />
)}
```

Also add helper function before the DataTable component:

```typescript
function getFilterTypeForColumn(columnId: string): 'text' | 'number' | 'boolean' | 'select' {
  // Simple heuristic - can be overridden via columnFilterConfigs
  if (columnId.includes('activo') || columnId.includes('Activo')) return 'boolean';
  if (columnId.includes('Id') || columnId.includes('numero') || columnId.includes('empleados')) return 'number';
  return 'text';
}
```

- [ ] **Step 6: Render ActiveFiltersBar above table**

After line 320 (after `{collapsible && <CollapsibleTrigger />}`), add:

```typescript
{filterEnabled && (
  <>
    <ActiveFiltersBar
      filters={activeFilters}
      onRemoveFilter={removeFilter}
      onClearAll={clearAllFilters}
    />
  </>
)}
```

- [ ] **Step 7: Render FilterConfig button in toolbar**

In the toolbar section (around line 350-400), add:

```typescript
{filterEnabled && (
  <FilterConfig
    tableId={filterConfig.tableId}
    allColumns={columns.map(col => ({ id: col.id || col.accessorKey as string, header: String(col.header || col.id) }))}
    searchableColumns={searchColumnIds}
    visibleColumns={visibleColumnIds}
    onSearchColumnsChange={setSearchColumnIds}
    onVisibleColumnsChange={setVisibleColumnIds}
    onReset={resetToDefaults}
  />
)}
```

- [ ] **Step 8: Commit**

```bash
git add lefarma.frontend/src/components/ui/data-table.tsx
git commit -m "feat(table): extend DataTable with filterConfig support"
```

---

## Task 8: Proof of Concept - Empresas Table

**Files:**
- Modify: `lefarma.frontend/src/pages/catalogos/generales/Empresas/EmpresasList.tsx`

Add filterConfig to the Empresas table as the first proof of concept.

- [ ] **Step 1: Add filterConfig to DataTable**

Find the DataTable component (around line 320-350 in EmpresasList.tsx) and add filterConfig prop:

```typescript
// Find this section (around line 320):
<DataTable
  columns={columns}
  data={filteredEmpresas}
  title="Empresas"
  showRefreshButton
  onRefresh={fetchEmpresas}
  // ... other props
/>

// Change to:
<DataTable
  columns={columns}
  data={filteredEmpresas}
  title="Empresas"
  showRefreshButton
  onRefresh={fetchEmpresas}
  filterConfig={{
    tableId: 'empresas',
    searchableColumns: ['nombre', 'rfc', 'razonSocial', 'ciudad', 'estado', 'email', 'telefono'],
    defaultSearchColumns: ['nombre'],
  }}
  // ... other props
/>
```

**Column types for Empresas:**
- `activo` - boolean filter (Todos/Activo/Inactivo)
- `numeroEmpleados` - number filter (=, ≠, >, <, entre)
- All other columns - text filter (contiene, exacta, empieza con, termina con)

- [ ] **Step 2: Test in browser**

Run `npm run dev` in lefarma.frontend and navigate to http://localhost:5173/catalogos/empresas

Verify:
- [ ] Search bar filters in default columns (nombre)
- [ ] Filter icon appears in column headers
- [ ] Clicking filter icon opens popover
- [ ] Applying filter shows badge in ActiveFiltersBar
- [ ] Clicking × on badge removes filter
- [ ] ⚙️ button opens configuration panel
- [ ] Checkboxes work for search columns and visible columns
- [ ] Configuration persists after page refresh
- [ ] Reset button restores defaults

- [ ] **Step 3: Commit**

```bash
git add lefarma.frontend/src/pages/catalogos/generales/Empresas/EmpresasList.tsx
git commit -m "feat(catalogos): add filterConfig to Empresas table (PoC #1)"
```

---

## Task 9: Second Proof of Concept - Proveedores Table

**Files:**
- Modify: `lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx`

Add filterConfig to Proveedores table as second validation.

- [ ] **Step 1: Add filterConfig to DataTable**

```typescript
<DataTable
  columns={columns}
  data={filteredProveedores}
  filterConfig={{
    tableId: 'proveedores',
    searchableColumns: ['razonSocial', 'rfc', 'personaContacto'],
    defaultSearchColumns: ['razonSocial'],
  }}
  // ... other props
/>
```

- [ ] **Step 2: Test in browser**

Navigate to http://localhost:5173/catalogos/proveedores

Verify same functionality as Empresas table works correctly.

- [ ] **Step 3: Commit**

```bash
git add lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx
git commit -m "feat(catalogos): add filterConfig to Proveedores table (PoC #2)"
```

---

## Task 10: Rollout to Remaining Catalogs

Add filterConfig to the remaining 9 catalog tables.

**Order:** sucursales → areas → gastos → medidas → formas-pago → centros-costo → cuentas-contables → estatus-orden → regimenes-fiscales

### Sucursales Table

- [ ] **Add filterConfig to SucursalesList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredSucursales}
  filterConfig={{
    tableId: 'sucursales',
    searchableColumns: ['nombre', 'ciudad', 'estado', 'direccion', 'telefono'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

- [ ] Test and commit

### Areas Table

- [ ] **Add filterConfig to AreasList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredAreas}
  filterConfig={{
    tableId: 'areas',
    searchableColumns: ['nombre', 'descripcion'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

- [ ] Test and commit

### Gastos Table

- [ ] **Add filterConfig to GastosList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredGastos}
  filterConfig={{
    tableId: 'gastos',
    searchableColumns: ['nombre', 'descripcion', 'cuentaContable'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

- [ ] Test and commit

### Medidas Table

- [ ] **Add filterConfig to MedidasList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredMedidas}
  filterConfig={{
    tableId: 'medidas',
    searchableColumns: ['nombre', 'abreviatura'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

- [ ] Test and commit

### FormasPago Table

- [ ] **Add filterConfig to FormasPagoList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredFormasPago}
  filterConfig={{
    tableId: 'formas-pago',
    searchableColumns: ['nombre', 'descripcion'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

- [ ] Test and commit

### CentrosCosto Table

- [ ] **Add filterConfig to CentrosCostoList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredCentrosCosto}
  filterConfig={{
    tableId: 'centros-costo',
    searchableColumns: ['nombre', 'codigo', 'descripcion'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

- [ ] Test and commit

### CuentasContables Table

- [ ] **Add filterConfig to CuentasContablesList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredCuentasContables}
  filterConfig={{
    tableId: 'cuentas-contables',
    searchableColumns: ['codigo', 'nombre', 'nivel'],
    defaultSearchColumns: ['codigo'],
  }}
/>
```

- [ ] Test and commit

### EstatusOrden Table

- [ ] **Add filterConfig to EstatusOrdenList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredEstatus}
  filterConfig={{
    tableId: 'estatus-orden',
    searchableColumns: ['nombre', 'descripcion'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

- [ ] Test and commit

### RegimenesFiscales Table

- [ ] **Add filterConfig to RegimenesFiscalesList.tsx**

```typescript
<DataTable
  columns={columns}
  data={filteredRegimenes}
  filterConfig={{
    tableId: 'regimenes-fiscales',
    searchableColumns: ['clave', 'descripcion', 'tipoPersona'],
    defaultSearchColumns: ['descripcion'],
  }}
/>
```

- [ ] Test and commit

**Commit message format for each:**
```bash
git commit -m "feat(catalogos): add filterConfig to [TableName] table"
```

---

## Task 11: Final Testing and Documentation

**Files:**
- Modify: `lefarma.frontend/README.md` (optional)

- [ ] **Step 1: Cross-browser testing**

Test in Chrome, Firefox, and Edge to ensure compatibility.

- [ ] **Step 2: Mobile responsive testing**

Test on mobile viewport (375px width) to ensure:
- [ ] FilterConfig panel opens as Dialog on mobile
- [ ] Badges wrap properly on small screens
- [ ] Popovers don't overflow viewport

- [ ] **Step 3: Accessibility check**

- [ ] All icons have aria-label
- [ ] Popovers trap focus
- [ ] Badges are keyboard accessible (Enter/Space to remove)
- [ ] Checkboxes have proper labels

- [ ] **Step 4: Update documentation (optional)**

If desired, add a section to README.md describing how to add filterConfig to new tables.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat(table): complete table filters and search system implementation"
```

---

## Success Criteria

After completing all tasks:

✅ All 11 catalog tables have filterConfig
✅ Text filters work (contains, exact, startsWith, endsWith)
✅ Number filters work (=, ≠, >, <)
✅ Boolean filters work (Todos/Activo/Inactivo)
✅ Select multi filters work (checkboxes)
✅ Active filters display as badges
✅ Individual filter removal works
✅ "Limpiar todos" button works
✅ Search columns configurable via ⚙️ panel
✅ Column visibility configurable via ⚙️ panel
✅ Reset button restores defaults
✅ Configuration persists across sessions
✅ No breaking changes to existing tables
✅ Mobile responsive
✅ Accessible

---

## Notes for Implementation

1. **TanStack Table Integration**: The DataTable already uses `getFilteredRowModel()` from TanStack Table. Our filters will populate `columnFilters` state which TanStack Table automatically applies.

2. **Column IDs**: When adding filterConfig, ensure the `columnId` values match the `id` or `accessorKey` in the column definitions.

3. **Filter Type Detection**: For now, filter types are determined by the `columnFilterConfigs` option in filterConfig. Future enhancement: auto-detect from column data type.

4. **Performance**: All filtering happens client-side. If any catalog grows beyond 1000 rows, consider server-side filtering.

5. **Testing Strategy**: Test each table individually after adding filterConfig. Don't batch all migrations - catch issues early.

6. **Browser DevTools**: Use DevTools Application → Local Storage to inspect `table-configs` during development to verify persistence.

7. **Edge Cases Handled**:
   - Empty filter values are ignored
   - "Todos" in boolean filter removes the filter
   - Deselecting all columns in visibility shows warning or prevents action
   - localStorage errors are caught and logged

8. **Future Enhancements** (NOT in scope):
   - Filter combinations (AND/OR between conditions)
   - Export filtered data
   - Save filter presets
   - Server-side filtering for large datasets
