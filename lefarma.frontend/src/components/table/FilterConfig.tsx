import { useState } from "react";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

interface Column {
  id: string;
  header: string;
}

interface ColumnFilterConfig {
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  textOperator?: 'contains' | 'exact';
  textCaseSensitive?: boolean;
  numberMin?: number;
  numberMax?: number;
  numberOperator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
  booleanValue?: 'all' | 'true' | 'false';
  dateFrom?: string;
  dateTo?: string;
}

interface FilterConfigProps {
  tableId: string;
  allColumns: Column[];
  searchableColumns: string[];
  visibleColumns: string[];
  onSearchColumnsChange: (columnIds: string[]) => void;
  onVisibleColumnsChange: (columnIds: string[]) => void;
  onReset: () => void;
  columnFilterConfigs?: Record<string, ColumnFilterConfig>;
  onColumnFilterChange?: (columnId: string, config: ColumnFilterConfig) => void;
  onSave?: (searchColumns: string[], visibleColumns: string[]) => void;
  onApplyChanges?: () => void;
}

function getFilterTypeForColumn(columnId: string): ColumnFilterConfig['type'] {
  if (!columnId) return 'text';
  if (columnId.includes('activo') || columnId.includes('Activo')) return 'boolean';
  if (columnId.includes('fecha') || columnId.includes('Fecha') || columnId.includes('date') || columnId.includes('Date')) return 'date';
  if (columnId.includes('Id') || columnId.includes('numero') || columnId.includes('empleados')) return 'number';
  return 'text';
}

export const FilterConfig = ({
  tableId,
  allColumns,
  searchableColumns,
  visibleColumns,
  onSearchColumnsChange,
  onVisibleColumnsChange,
  onReset,
  columnFilterConfigs = {},
  onColumnFilterChange,
  onSave,
  onApplyChanges,
}: FilterConfigProps) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && onSave) {
      onSave(searchableColumns, visibleColumns);
    }
  };

  const handleSearchColumnToggle = (columnId: string, checked: boolean) => {
    if (checked) {
      onSearchColumnsChange([...searchableColumns, columnId]);
    } else {
      onSearchColumnsChange(searchableColumns.filter((id) => id !== columnId));
    }
  };

  const handleVisibleColumnToggle = (columnId: string, checked: boolean) => {
    if (checked) {
      onVisibleColumnsChange([...visibleColumns, columnId]);
    } else {
      onVisibleColumnsChange(visibleColumns.filter((id) => id !== columnId));
    }
  };

  const handleReset = () => {
    onReset();
    onApplyChanges?.(); // Sync columns immediately after reset
    toast.success("Configuración restaurada a valores por defecto");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configurar tabla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar tabla: {tableId}</DialogTitle>
          <DialogDescription>
            Configura búsqueda, visibilidad y filtros avanzados por columna. Los cambios se guardan automáticamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="buscador" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="buscador">Buscador</TabsTrigger>
            <TabsTrigger value="visibilidad">Visibilidad</TabsTrigger>
            <TabsTrigger value="filtros">Filtros</TabsTrigger>
          </TabsList>

          {/* Tab 1: Buscador */}
          <TabsContent value="buscador" className="space-y-4 mt-4">
            <div className="space-y-3">
              <h3 className="font-medium">Buscar en estas columnas</h3>
              <p className="text-xs text-muted-foreground">
                El buscador general buscará en las columnas seleccionadas
              </p>
              <div className="space-y-2">
                {allColumns.filter(c => c.id !== undefined && c.id !== null).map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`search-${column.id}`}
                      checked={searchableColumns.includes(column.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSearchColumnsChange([...searchableColumns, column.id]);
                        } else {
                          onSearchColumnsChange(searchableColumns.filter((id) => id !== column.id));
                        }
                      }}
                    />
                    <Label htmlFor={`search-${column.id}`} className="text-sm cursor-pointer">
                      {column.header}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Visibilidad */}
          <TabsContent value="visibilidad" className="space-y-4 mt-4">
            <div className="space-y-3">
              <h3 className="font-medium">Columnas visibles</h3>
              <p className="text-xs text-muted-foreground">
                Selecciona las columnas que quieres mostrar en la tabla
              </p>
              <div className="space-y-2">
                {allColumns.filter(c => c.id !== undefined && c.id !== null).map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`visible-${column.id}`}
                      checked={visibleColumns.includes(column.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onVisibleColumnsChange([...visibleColumns, column.id]);
                        } else {
                          onVisibleColumnsChange(visibleColumns.filter((id) => id !== column.id));
                        }
                      }}
                    />
                    <Label htmlFor={`visible-${column.id}`} className="text-sm cursor-pointer">
                      {column.header}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Filtros por columna */}
          <TabsContent value="filtros" className="space-y-4 mt-4">
            <div className="space-y-4">
              {allColumns.filter(c => c.id !== undefined && c.id !== null).map((column) => {
                const config = columnFilterConfigs[column.id] || {};
                const filterType = config.type || getFilterTypeForColumn(column.id);

                return (
                  <Collapsible key={column.id} defaultOpen={false}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-accent transition-colors">
                      <span className="font-medium">{column.header}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                          {filterType}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3 space-y-3">
                      {/* Filter type selector */}
                      <div className="flex items-center gap-2 pt-2">
                        <Label className="text-xs whitespace-nowrap">Tipo de filtro:</Label>
                        <Select
                          value={filterType}
                          onValueChange={(value) => onColumnFilterChange?.(column.id, { ...config, type: value as any })}
                        >
                          <SelectTrigger className="w-40 h-8">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Texto</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="boolean">Booleano</SelectItem>
                            <SelectItem value="date">Fecha</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filter inputs based on type */}
                      {filterType === 'text' && (
                        <div className="space-y-2 pl-2 border-l-2 ml-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`contains-${column.id}`}
                              checked={config.textOperator === 'contains'}
                              onCheckedChange={(checked) => checked && onColumnFilterChange?.(column.id, { ...config, textOperator: 'contains' })}
                            />
                            <Label htmlFor={`contains-${column.id}`} className="text-sm cursor-pointer">Contains (coincidencia parcial)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`exact-${column.id}`}
                              checked={config.textOperator === 'exact'}
                              onCheckedChange={(checked) => checked && onColumnFilterChange?.(column.id, { ...config, textOperator: 'exact' })}
                            />
                            <Label htmlFor={`exact-${column.id}`} className="text-sm cursor-pointer">Exact match (coincidencia exacta)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`case-${column.id}`}
                              checked={config.textCaseSensitive || false}
                              onCheckedChange={(checked) => onColumnFilterChange?.(column.id, { ...config, textCaseSensitive: !!checked })}
                            />
                            <Label htmlFor={`case-${column.id}`} className="text-sm cursor-pointer">Distinguir mayúsculas/minúsculas</Label>
                          </div>
                        </div>
                      )}

                      {filterType === 'number' && (
                        <div className="space-y-3 pl-2 border-l-2 ml-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Mínimo</Label>
                              <Input
                                type="number"
                                value={config.numberMin || ''}
                                onChange={(e) => onColumnFilterChange?.(column.id, { ...config, numberMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                                placeholder="Sin mínimo"
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Máximo</Label>
                              <Input
                                type="number"
                                value={config.numberMax || ''}
                                onChange={(e) => onColumnFilterChange?.(column.id, { ...config, numberMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                                placeholder="Sin máximo"
                                className="h-8"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Operador</Label>
                            <Select value={config.numberOperator || '='} onValueChange={(value) => onColumnFilterChange?.(column.id, { ...config, numberOperator: value as any })}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value=">=">Mayor o igual (&gt;=)</SelectItem>
                                <SelectItem value="<=">Menor o igual (&lt;=)</SelectItem>
                                <SelectItem value="=">Igual (=)</SelectItem>
                                <SelectItem value="!=">Diferente (!=)</SelectItem>
                                <SelectItem value=">">Mayor (&gt;)</SelectItem>
                                <SelectItem value="<">Menor (&lt;)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {filterType === 'boolean' && (
                        <div className="space-y-2 pl-2 border-l-2 ml-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`all-${column.id}`}
                              checked={config.booleanValue === 'all' || !config.booleanValue}
                              onCheckedChange={() => onColumnFilterChange?.(column.id, { ...config, booleanValue: 'all' })}
                            />
                            <Label htmlFor={`all-${column.id}`} className="text-sm cursor-pointer">Todos</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`true-${column.id}`}
                              checked={config.booleanValue === 'true'}
                              onCheckedChange={() => onColumnFilterChange?.(column.id, { ...config, booleanValue: 'true' })}
                            />
                            <Label htmlFor={`true-${column.id}`} className="text-sm cursor-pointer">Activo (true)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`false-${column.id}`}
                              checked={config.booleanValue === 'false'}
                              onCheckedChange={() => onColumnFilterChange?.(column.id, { ...config, booleanValue: 'false' })}
                            />
                            <Label htmlFor={`false-${column.id}`} className="text-sm cursor-pointer">Inactivo (false)</Label>
                          </div>
                        </div>
                      )}

                      {filterType === 'date' && (
                        <div className="space-y-3 pl-2 border-l-2 ml-2">
                          <div>
                            <Label className="text-xs">Desde</Label>
                            <Input
                              type="date"
                              value={config.dateFrom || ''}
                              onChange={(e) => onColumnFilterChange?.(column.id, { ...config, dateFrom: e.target.value })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Hasta</Label>
                            <Input
                              type="date"
                              value={config.dateTo || ''}
                              onChange={(e) => onColumnFilterChange?.(column.id, { ...config, dateTo: e.target.value })}
                              className="h-8"
                            />
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Restaurar defaults
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => {
            onSave?.(searchableColumns, visibleColumns);
            onApplyChanges?.();
            setOpen(false);
          }}>
            Aplicar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
