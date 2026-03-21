import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { Empresa, Sucursal } from '@/types/auth.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Building2, Building, AlertCircle, Loader2 } from 'lucide-react';

interface CambiarUbicacionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CambiarUbicacionModal({
  open,
  onOpenChange,
}: CambiarUbicacionModalProps) {
  const { user, changeEmpresaSucursal } = useAuthStore();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalesFiltradas, setSucursalesFiltradas] = useState<Sucursal[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Resetear cuando se abre el modal
  useEffect(() => {
    if (open) {
      setSelectedEmpresa('');
      setSelectedSucursal('');
      setError('');
      loadData();
    }
  }, [open]);

  // Filtrar sucursales cuando se selecciona una empresa
  useEffect(() => {
    if (selectedEmpresa) {
      const filtradas = sucursales.filter((s) => {
        if (!s.idSucursal || s.idSucursal === undefined) return false;
        if (!s.idEmpresa || s.idEmpresa === undefined) return false;
        return String(s.idEmpresa) === String(selectedEmpresa);
      });
      setSucursalesFiltradas(filtradas);

      // Auto-seleccionar si solo hay una
      if (filtradas.length === 1) {
        const sucursal = filtradas[0];
        if (sucursal.idSucursal && sucursal.idSucursal !== undefined) {
          setSelectedSucursal(String(sucursal.idSucursal));
        }
      } else {
        setSelectedSucursal('');
      }
    } else {
      setSucursalesFiltradas([]);
      setSelectedSucursal('');
    }
  }, [selectedEmpresa, sucursales]);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [empresasData, sucursalesData] = await Promise.all([
        authService.getEmpresas(),
        authService.getSucursales(),
      ]);

      setEmpresas(empresasData);
      setSucursales(sucursalesData);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al cargar empresas y sucursales';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedEmpresa) {
      setError('Por favor selecciona una empresa');
      return;
    }

    if (!selectedSucursal) {
      setError('Por favor selecciona una sucursal');
      return;
    }

    try {
      changeEmpresaSucursal(
        { idEmpresa: selectedEmpresa } as Empresa,
        { idSucursal: selectedSucursal } as Sucursal
      );
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cambiar ubicación';
      setError(message);
    }
  };

  const empresaSeleccionada = empresas.find(
    (e) => String(e.idEmpresa) === String(selectedEmpresa)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Cambiar Ubicación</DialogTitle>
          <DialogDescription>
            Selecciona la empresa y sucursal donde trabajarás
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info del usuario */}
          {user?.nombre && (
            <div className="text-center py-2 px-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Usuario</p>
              <p className="font-medium">{user.nombre}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Cargando empresas y sucursales...
              </span>
            </div>
          )}

          {/* Selección de Empresa */}
          {!isLoading && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresa
              </label>
              <Select
                value={selectedEmpresa}
                onValueChange={setSelectedEmpresa}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa, index) => (
                    <SelectItem
                      key={empresa.idEmpresa || `empresa-${index}`}
                      value={String(empresa.idEmpresa || '')}
                    >
                      {empresa.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selección de Sucursal */}
          {selectedEmpresa && !isLoading && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4" />
                Sucursal
                {empresaSeleccionada && (
                  <span className="text-muted-foreground font-normal">
                    - {empresaSeleccionada.nombre}
                  </span>
                )}
              </label>
              <Select
                value={selectedSucursal}
                onValueChange={setSelectedSucursal}
                disabled={sucursalesFiltradas.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursalesFiltradas.map((sucursal, index) => (
                    <SelectItem
                      key={sucursal.idSucursal || `sucursal-${index}`}
                      value={String(sucursal.idSucursal || '')}
                    >
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {sucursalesFiltradas.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay sucursales disponibles para esta empresa.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedEmpresa || !selectedSucursal || isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Procesando...' : 'Confirmar Cambio'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
