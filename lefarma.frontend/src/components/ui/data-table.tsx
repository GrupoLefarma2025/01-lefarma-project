import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type PaginationState,
  type RowSelectionState,
  type Updater,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronsUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  RefreshCwIcon,
  Settings2Icon,
  SearchIcon,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTableFilters } from '@/hooks/useTableFilters';
import { FilterConfig } from '@/components/table/FilterConfig';
import { ActiveFiltersBar } from '@/components/table/ActiveFiltersBar';
import { ColumnFilterPopover } from '@/components/table/ColumnFilterPopover';
import type { FilterConfig as FilterConfigType } from '@/types/table.types';
import { useConfigStore } from '@/store/configStore';
import { Skeleton } from '@/components/ui/skeleton';

export type { ColumnDef } from '@tanstack/react-table';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];

  // Estéticos / layout
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  className?: string;
  height?: number; // px fijo para el cuerpo de la tabla

  // Funcionalidades
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  globalFilter?: boolean; // muestra buscador interno
  pagination?: boolean;
  pageSize?: number;
  showRowCount?: boolean;

  // Botones de acciones
  showExportButton?: boolean;
  showRefreshButton?: boolean;
  showColumnToggle?: boolean;

  // Callbacks
  onExport?: () => void;
  onRefresh?: () => void;
  onRowClick?: (row: TData) => void;
  isRowSelected?: (row: TData) => boolean;

  // Row selection
  enableRowSelection?: boolean;
  onSelectionChange?: (rows: TData[]) => void;
  getRowId?: (row: TData, index: number) => string;

  // Paginación controlada / server-side
  manualPagination?: boolean;
  totalCount?: number;
  paginationState?: PaginationState;
  onPaginationChange?: (state: PaginationState) => void;

  // Configuración de filtros
  filterConfig?: FilterConfigType;

  loading?: boolean;
  density?: 'compact' | 'standard' | 'comfortable';
  pageSizeOverride?: number; // renombrado para evitar conflicto con el pageSize existente
}

// ─── Función auxiliar de encabezado de ordenamiento ─────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc') return <ArrowUpIcon className="ml-1.5 h-3.5 w-3.5" />;
  if (direction === 'desc') return <ArrowDownIcon className="ml-1.5 h-3.5 w-3.5" />;
  return <ChevronsUpDownIcon className="ml-1.5 h-3.5 w-3.5 opacity-40" />;
}

// ─── Función auxiliar de tipo de filtro ─────────────────────────────────────────────────────────

function getFilterTypeForColumn(
  columnId: string
): 'text' | 'number' | 'boolean' | 'select' | 'date' {
  if (!columnId) return 'text';
  if (columnId.includes('activo') || columnId.includes('Activo')) return 'boolean';
  if (
    columnId.includes('fecha') ||
    columnId.includes('Fecha') ||
    columnId.includes('date') ||
    columnId.includes('Date')
  )
    return 'date';
  if (columnId.includes('Id') || columnId.includes('numero') || columnId.includes('empleados'))
    return 'number';
  return 'text';
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function DataTable<TData>({
  columns,
  data,
  title,
  subtitle,
  footer,
  className,
  height,
  collapsible = true,
  defaultCollapsed = false,
  globalFilter = false,
  pagination = false,
  pageSize = 20,
  showRowCount = true,
  showExportButton = false,
  showRefreshButton = false,
  showColumnToggle = false,
  onExport,
  onRefresh,
  onRowClick,
  isRowSelected,
  filterConfig,
  enableRowSelection = false,
  onSelectionChange,
  getRowId,
  loading = false,
  density,
  pageSizeOverride,
  manualPagination,
  totalCount,
  paginationState: paginationStateProp,
  onPaginationChange,
}: DataTableProps<TData>) {
  const { ui } = useConfigStore();

  // Usa la configuración si no se proporciona explícitamente
  const tableDensity = density || ui.componentes.tables.density;
  const tablePageSize = pageSizeOverride || pageSize || ui.componentes.tables.defaultPageSize;

  const selectionColumn = useMemo<ColumnDef<TData>>(() => ({
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && 'indeterminate')}
        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        aria-label="Seleccionar todos"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }), []);

  const displayColumns = useMemo<ColumnDef<TData, unknown>[]>(
    () => (enableRowSelection ? [selectionColumn, ...columns] : columns),
    [enableRowSelection, selectionColumn, columns]
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilterValue, setGlobalFilterValue] = useState('');
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: tablePageSize,
  });
  const effectivePagination = paginationStateProp ?? internalPagination;
  const isControlledPagination = Boolean(paginationStateProp && onPaginationChange);

  const handlePaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next =
        typeof updater === 'function'
          ? (updater as (state: PaginationState) => PaginationState)(effectivePagination)
          : updater;
      if (isControlledPagination && onPaginationChange) {
        onPaginationChange(next);
      } else {
        setInternalPagination(next);
      }
    },
    [effectivePagination, isControlledPagination, onPaginationChange]
  );

  const pageCount = useMemo(() => {
    if (!manualPagination || totalCount == null) return undefined;
    return Math.max(1, Math.ceil(totalCount / effectivePagination.pageSize));
  }, [manualPagination, totalCount, effectivePagination.pageSize]);

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showColMenu, setShowColMenu] = useState(false);

  // Lógica de filtrado
  const filterEnabled = !!filterConfig;
  const {
    activeFilters,
    searchColumnIds,
    visibleColumnIds,
    addFilter,
    removeFilter,
    clearAllFilters,
    setSearchColumns,
    setVisibleColumns,
    resetToDefaults,
    columnFilterConfigs,
    setColumnFilterConfig,
    saveConfig,
  } = useTableFilters({
    tableId: filterConfig?.tableId || '',
    allColumns: columns,
    defaultSearchColumns: filterConfig?.defaultSearchColumns,
    columnFilterConfigs: filterConfig?.columnFilterConfigs,
  });

  // Manejador de guardado que recibe los valores actuales de FilterConfig y guarda inmediatamente
  const handleSave = useCallback(
    (currentSearchColumns: string[], currentVisibleColumns: string[]) => {
      // Guarda inmediatamente con los valores actuales de FilterConfig
      saveConfig({
        searchColumns: currentSearchColumns,
        visibleColumns: currentVisibleColumns,
      });
      // Luego actualiza el estado del hook por consistencia
      setSearchColumns(currentSearchColumns);
      setVisibleColumns(currentVisibleColumns);
    },
    [saveConfig, setSearchColumns, setVisibleColumns]
  );

  // Sincroniza la visibilidad de columnas cuando filterConfig está habilitado y visibleColumnIds cambia
  useEffect(() => {
    if (filterEnabled && visibleColumnIds.length > 0) {
      const allColumnIds = columns
        .map(
          (col) =>
            col.id ||
            ('accessorKey' in col && typeof col.accessorKey === 'string' ? col.accessorKey : '')
        )
        .filter(Boolean);
      const newVisibility: Record<string, boolean> = {};
      allColumnIds.forEach((id) => {
        newVisibility[id] = visibleColumnIds.includes(id);
      });
      setColumnVisibility(newVisibility);
    }
  }, [filterEnabled, visibleColumnIds, columns]); // Se ejecuta cuando visibleColumnIds cambia

  // Función de sincronización: solo se llama explícitamente (botón Aplicar, Reset, etc.)
  const syncColumnVisibility = useCallback(() => {
    if (filterEnabled && visibleColumnIds.length > 0) {
      const allColumnIds = columns
        .map(
          (col) =>
            col.id ||
            ('accessorKey' in col && typeof col.accessorKey === 'string' ? col.accessorKey : '')
        )
        .filter(Boolean);
      const newVisibility: Record<string, boolean> = {};
      allColumnIds.forEach((id) => {
        newVisibility[id] = visibleColumnIds.includes(id);
      });
      setColumnVisibility(newVisibility);
    }
  }, [filterEnabled, visibleColumnIds, columns]);

  // Convierte activeFilters al formato de TanStack Table
  const computedColumnFilters = useMemo(() => {
    return activeFilters.map((filter) => ({
      id: filter.columnId,
      value: filter.value,
    }));
  }, [activeFilters]);

  const table = useReactTable({
    data,
    columns: displayColumns,
    state: {
      sorting,
      columnFilters: filterEnabled ? computedColumnFilters : columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: globalFilterValue,
      pagination: effectivePagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilterValue,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: false,
    enableRowSelection,
    getRowId: getRowId ? (row, index) => getRowId(row, index) : undefined,
    ...(pagination && !manualPagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(manualPagination ? { manualPagination: true as const, pageCount } : {}),
  });

  const selectedRows = useMemo(() => {
    const selectedIds = new Set(
      Object.keys(rowSelection).filter((id) => rowSelection[id])
    );
    if (selectedIds.size === 0) return [];
    return data.filter((row, index) =>
      selectedIds.has(getRowId ? getRowId(row, index) : String(index))
    );
  }, [rowSelection, data, getRowId]);

  const prevSelectedRowsRef = useRef<TData[]>([]);
  useEffect(() => {
    const prev = prevSelectedRowsRef.current;
    const changed =
      selectedRows.length !== prev.length ||
      selectedRows.some((row, index) => row !== prev[index]);
    if (changed) {
      onSelectionChange?.(selectedRows);
      prevSelectedRowsRef.current = selectedRows;
    }
  }, [selectedRows, onSelectionChange]);

  const visibleColumns = table.getAllColumns().filter((c) => c.getCanHide());

  return (
    <div
      className={cn(
        'w-full rounded-xl border bg-card shadow-md backdrop-blur-sm',
        tableDensity === 'compact' && 'data-table-compact',
        tableDensity === 'comfortable' && 'data-table-comfortable',
        className
      )}
    >
      {/* ── Header card ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              onClick={() => setCollapsed((p) => !p)}
              className="rounded-md p-1 text-foreground transition-colors hover:bg-muted"
            >
              {collapsed ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronUpIcon className="h-4 w-4" />
              )}
            </button>
          )}
          <div>
            {title && <div className="text-base font-semibold text-foreground">{title}</div>}
            {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Column visibility toggle */}
          {showColumnToggle && !collapsed && (
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setShowColMenu((p) => !p)}
              >
                <Settings2Icon className="h-3.5 w-3.5" />
                Columnas
              </Button>
              {showColMenu && (
                <div className="absolute right-0 top-9 z-10 min-w-[160px] rounded-lg border bg-card p-2 shadow-lg">
                  {visibleColumns.map((col) => (
                    <label
                      key={col.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                        className="h-3.5 w-3.5 accent-blue-600"
                      />
                      {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {filterEnabled && (
            <FilterConfig
              tableId={filterConfig.tableId}
              allColumns={columns.map((col) => ({
                id:
                  col.id ||
                  ('accessorKey' in col && typeof col.accessorKey === 'string'
                    ? col.accessorKey
                    : '') ||
                  '',
                header: String(
                  col.header ||
                    col.id ||
                    ('accessorKey' in col && typeof col.accessorKey === 'string'
                      ? col.accessorKey
                      : '')
                ),
              }))}
              searchableColumns={searchColumnIds}
              visibleColumns={visibleColumnIds}
              onSearchColumnsChange={setSearchColumns}
              onVisibleColumnsChange={setVisibleColumns}
              onReset={resetToDefaults}
              columnFilterConfigs={columnFilterConfigs}
              onColumnFilterChange={setColumnFilterConfig}
              onSave={handleSave}
              onApplyChanges={syncColumnVisibility}
            />
          )}

          {showRefreshButton && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onRefresh}>
              <RefreshCwIcon className="h-3.5 w-3.5" />
              Actualizar
            </Button>
          )}

          {showExportButton && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onExport}>
              <DownloadIcon className="h-3.5 w-3.5" />
              Exportar
            </Button>
          )}
        </div>
      </div>

      {/* ── Table body ── */}
      {!collapsed && (
        <>
          {filterEnabled && (
            <ActiveFiltersBar
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearAll={clearAllFilters}
            />
          )}
          {globalFilter && !collapsed && (
            <div className="flex items-center gap-2 border-b border-muted px-4 py-2">
              <div className="relative w-full sm:w-72">
                <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 w-full pl-8 text-sm"
                  placeholder="Buscar en resultados..."
                  value={globalFilterValue}
                  onChange={(e) => setGlobalFilterValue(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="overflow-auto" style={height ? { height } : undefined}>
            <div className="relative">
              {loading && (
                <div className="bg-card/70 absolute inset-0 z-10 flex flex-col gap-2 p-4 backdrop-blur-sm">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-muted/60 hover:bg-muted/60">
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={cn(
                            'whitespace-nowrap text-xs font-semibold text-foreground',
                            header.column.getCanSort() && 'cursor-pointer select-none'
                          )}
                          onClick={
                            header.column.getCanSort()
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          {header.isPlaceholder ? null : (
                            <div className="flex items-center">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                <SortIcon direction={header.column.getIsSorted()} />
                              )}
                              {filterConfig &&
                                filterConfig.searchableColumns.includes(header.id) && (
                                  <ColumnFilterPopover
                                    columnId={header.id}
                                    columnName={String(header.column.columnDef.header)}
                                    filterType={getFilterTypeForColumn(header.id)}
                                    hasActiveFilter={activeFilters.some(
                                      (f) => f.columnId === header.id
                                    )}
                                    onApplyFilter={addFilter}
                                    onClearFilter={() => removeFilter(header.id)}
                                  />
                                )}
                            </div>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => {
                      const selected = isRowSelected?.(row.original) ?? false;
                      return (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() ? 'selected' : undefined}
                          className={cn(
                            'text-sm',
                            onRowClick && 'hover:bg-muted/50',
                            selected && 'border-l-2 border-l-primary',
                            row.getIsSelected() && 'bg-muted/30'
                          )}
                          style={
                            selected
                              ? {
                                  backgroundColor:
                                    'color-mix(in srgb, var(--primary) 12%, transparent)',
                                }
                              : undefined
                          }
                          onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={displayColumns.length}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        Sin resultados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Pagination ── */}
          {pagination && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-muted px-4 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span>
                  Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                </span>
                {manualPagination && totalCount !== undefined && (
                  <span>
                    Total: <strong className="text-foreground">{totalCount}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Mostrar</span>
                  <Select
                    value={String(effectivePagination.pageSize)}
                    onValueChange={(value) => {
                      const size = Number(value);
                      handlePaginationChange({ pageIndex: 0, pageSize: size });
                    }}
                  >
                    <SelectTrigger className="h-7 w-16 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map((size) => (
                        <SelectItem key={size} value={String(size)} className="text-xs">
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">por página</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    «
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    ‹
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    ›
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    »
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          {(showRowCount || footer) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-muted px-4 py-2">
              {showRowCount && (
                <span className="text-xs text-muted-foreground">
                  {manualPagination && totalCount !== undefined ? (
                    <>
                      Mostrando{' '}
                      <strong className="text-foreground">
                        {data.length} de {totalCount}
                      </strong>{' '}
                      registros
                    </>
                  ) : (
                    <>
                      Registros totales: <strong className="text-foreground">{data.length}</strong>
                      {table.getFilteredRowModel().rows.length !== data.length && (
                        <>
                          {' '}
                          (filtrados:{' '}
                          <strong className="text-foreground">
                            {table.getFilteredRowModel().rows.length}
                          </strong>
                          )
                        </>
                      )}
                    </>
                  )}
                </span>
              )}
              {footer && <div className="text-xs">{footer}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
