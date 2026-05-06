import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { Empresa, Sucursal } from '@/types/auth.types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Building2, Building, AlertCircle, ArrowLeft, Loader2, Lock } from 'lucide-react';
import logoEstatico from '@/assets/logo.png';


export default function SelectEmpresaSucursal() {
  const navigate = useNavigate();
  const { user, changeEmpresaSucursal, puedeSeleccionarEmpresas } = useAuthStore();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalesFiltradas, setSucursalesFiltradas] = useState<Sucursal[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-seleccionar empresa/sucursal si el usuario no puede cambiar
  useEffect(() => {
    if (!puedeSeleccionarEmpresas) {
      const storedEmpresa = authService.getEmpresa();
      const storedSucursal = authService.getSucursal();
      if (storedEmpresa) {
        setSelectedEmpresa(String(storedEmpresa.idEmpresa));
      }
      if (storedSucursal) {
        setSelectedSucursal(String(storedSucursal.idSucursal));
      }
    }
  }, [puedeSeleccionarEmpresas]);

  // Auto-submit si el usuario no puede seleccionar empresa/sucursal
  useEffect(() => {
    if (!puedeSeleccionarEmpresas && selectedEmpresa && selectedSucursal) {
      const form = document.getElementById('empresa-sucursal-form') as HTMLFormElement;
      if (form) {
        // Pequeño delay para asegurar que el state está actualizado
        const timer = setTimeout(() => {
          form.requestSubmit();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [puedeSeleccionarEmpresas, selectedEmpresa, selectedSucursal]);

  useEffect(() => {
    loadData();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedEmpresa) {
      setError('Por favor selecciona una empresa');
      return;
    }

    if (!selectedSucursal) {
      setError('Por favor selecciona una sucursal');
      return;
    }

    try {
      // Convertir a string para consistencia
      changeEmpresaSucursal(
        { idEmpresa: selectedEmpresa } as Empresa,
        { idSucursal: selectedSucursal } as Sucursal
      );
      // Si no puede seleccionar, ir directo al dashboard sin mostrar el select
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cambiar ubicación';
      setError(message);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const empresaSeleccionada = empresas.find(
    (e) => String(e.idEmpresa) === String(selectedEmpresa)
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <img
              src={logoEstatico}
              alt="Grupo LeFarma"
              style={{ width: '120px', height: 'auto' }}
            />
          </div>
          <CardTitle className="text-xl">Cambiar Ubicación</CardTitle>
          <CardDescription>
            Selecciona la empresa y sucursal donde trabajarás
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form id="empresa-sucursal-form" onSubmit={handleSubmit} className="space-y-4">
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
                  {!puedeSeleccionarEmpresas && <Lock className="h-3 w-3 text-muted-foreground" />}
                </label>
                <Select
                  value={selectedEmpresa}
                  onValueChange={setSelectedEmpresa}
                  disabled={isLoading || !puedeSeleccionarEmpresas}
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
                  {!puedeSeleccionarEmpresas && <Lock className="h-3 w-3 text-muted-foreground" />}
                  {empresaSeleccionada && (
                    <span className="text-muted-foreground font-normal">
                      - {empresaSeleccionada.nombre}
                    </span>
                  )}
                </label>
                <Select
                  value={selectedSucursal}
                  onValueChange={setSelectedSucursal}
                  disabled={sucursalesFiltradas.length === 0 || !puedeSeleccionarEmpresas}
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

            {/* Botones */}
            <div className="flex flex-col gap-2">
              {puedeSeleccionarEmpresas && (
                <Button
                  type="submit"
                  disabled={!selectedEmpresa || !selectedSucursal || isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Procesando...' : 'Confirmar Cambio'}
                </Button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" />
                {puedeSeleccionarEmpresas ? 'Cancelar' : 'Ir al Dashboard'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
