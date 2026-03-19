import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type PaginationState,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState, type ReactNode } from "react";
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
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type { ColumnDef } from "@tanstack/react-table";

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
}

// ─── Sorting header helper ─────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (direction === "asc") return <ArrowUpIcon className="ml-1.5 h-3.5 w-3.5" />;
  if (direction === "desc") return <ArrowDownIcon className="ml-1.5 h-3.5 w-3.5" />;
  return <ChevronsUpDownIcon className="ml-1.5 h-3.5 w-3.5 opacity-40" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showColMenu, setShowColMenu] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: globalFilterValue,
      pagination: paginationState,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilterValue,
    onPaginationChange: setPaginationState,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
  });

  const visibleColumns = table.getAllColumns().filter((c) => c.getCanHide());

  return (
    <div
      className={cn(
        "w-full rounded-xl border bg-card shadow-md backdrop-blur-sm",
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
            {title && (
              <div className="text-base font-semibold text-foreground">{title}</div>
            )}
            {subtitle && (
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Global search */}
          {globalFilter && !collapsed && (
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-48 pl-8 text-sm"
                placeholder="Buscar..."
                value={globalFilterValue}
                onChange={(e) => setGlobalFilterValue(e.target.value)}
              />
            </div>
          )}

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
                      {typeof col.columnDef.header === "string"
                        ? col.columnDef.header
                        : col.id}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {showRefreshButton && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={onRefresh}
            >
              <RefreshCwIcon className="h-3.5 w-3.5" />
              Actualizar
            </Button>
          )}

          {showExportButton && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onExport}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Exportar
            </Button>
          )}
        </div>
      </div>

      {/* ── Table body ── */}
      {!collapsed && (
        <>
          <div
            className="overflow-auto"
            style={height ? { height } : undefined}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/60 hover:bg-muted/60">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "whitespace-nowrap text-xs font-semibold text-foreground",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        onClick={
                          header.column.getCanSort()
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                      >
                        {header.isPlaceholder ? null : (
                          <div className="flex items-center">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getCanSort() && (
                              <SortIcon direction={header.column.getIsSorted()} />
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
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={cn(
                        "text-sm",
                        onRowClick && "cursor-pointer hover:bg-muted/50"
                      )}
                      onClick={
                        onRowClick
                          ? () => onRowClick(row.original)
                          : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* ── Pagination ── */}
          {pagination && (
            <div className="flex items-center justify-between border-t border-muted px-4 py-2 text-xs text-muted-foreground">
              <span>
                Página {table.getState().pagination.pageIndex + 1} de{" "}
                {table.getPageCount()}
              </span>
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
          )}

          {/* ── Footer ── */}
          {(showRowCount || footer) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-muted px-4 py-2">
              {showRowCount && (
                <span className="text-xs text-muted-foreground">
                  Registros totales:{" "}
                  <strong className="text-foreground">{data.length}</strong>
                  {table.getFilteredRowModel().rows.length !== data.length && (
                    <> (filtrados: <strong className="text-foreground">{table.getFilteredRowModel().rows.length}</strong>)</>
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
