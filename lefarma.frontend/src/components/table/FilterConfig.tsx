import { useState } from "react";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Column {
  id: string;
  header: string;
}

interface FilterConfigProps {
  tableId: string;
  allColumns: Column[];
  searchableColumns: string[];
  visibleColumns: string[];
  onSearchColumnsChange: (columnIds: string[]) => void;
  onVisibleColumnsChange: (columnIds: string[]) => void;
  onReset: () => void;
}

export const FilterConfig = ({
  tableId,
  allColumns,
  searchableColumns,
  visibleColumns,
  onSearchColumnsChange,
  onVisibleColumnsChange,
  onReset,
}: FilterConfigProps) => {
  const [open, setOpen] = useState(false);
  const [tempSearchableColumns, setTempSearchableColumns] = useState<string[]>(searchableColumns);
  const [tempVisibleColumns, setTempVisibleColumns] = useState<string[]>(visibleColumns);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset temp state when opening
      setTempSearchableColumns(searchableColumns);
      setTempVisibleColumns(visibleColumns);
    }
  };

  const handleSave = () => {
    onSearchColumnsChange(tempSearchableColumns);
    onVisibleColumnsChange(tempVisibleColumns);
    setOpen(false);
  };

  const handleSearchColumnToggle = (columnId: string) => {
    setTempSearchableColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleVisibleColumnToggle = (columnId: string) => {
    setTempVisibleColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleReset = () => {
    onReset();
    // Update temp state to reflect reset
    setTempSearchableColumns(searchableColumns);
    setTempVisibleColumns(visibleColumns);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configurar tabla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar tabla</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-4">
          {/* Searchable Columns Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Buscar en estas columnas</Label>
            <div className="space-y-2">
              {allColumns.map((column) => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`search-${tableId}-${column.id}`}
                    checked={tempSearchableColumns.includes(column.id)}
                    onCheckedChange={() => handleSearchColumnToggle(column.id)}
                  />
                  <Label
                    htmlFor={`search-${tableId}-${column.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {column.header}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Visible Columns Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Columnas visibles</Label>
            <div className="space-y-2">
              {allColumns.map((column) => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`visible-${tableId}-${column.id}`}
                    checked={tempVisibleColumns.includes(column.id)}
                    onCheckedChange={() => handleVisibleColumnToggle(column.id)}
                  />
                  <Label
                    htmlFor={`visible-${tableId}-${column.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {column.header}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Restaurar defaults
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button onClick={handleSave}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
