import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';
import { authService } from '@/shared/auth/authService';
import { Empresa, Sucursal } from '@/types/auth.types';
import type { Area } from '@/types/catalogo.types';
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
import { Building2, Building, MapPin, AlertCircle, ArrowLeft, Loader2, Lock } from 'lucide-react';
import logoEstatico from '@/assets/logo.png';


export default function SelectEmpresaSucursal() {
  const navigate = useNavigate();
  const { user, changeEmpresaSucursal, puedeSeleccionarEmpresas } = useAuthStore();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  // Pre-cargar la ubicación actual del usuario como DEFAULT vía lazy init (sin efecto).
  const [selectedEmpresa, setSelectedEmpresa] = useState(() => {
    const s = authService.getEmpresa();
    return s ? String(s.idEmpresa) : '';
  });
  const [selectedSucursal, setSelectedSucursal] = useState(() => {
    const s = authService.getSucursal();
    return s ? String(s.idSucursal) : '';
  });
  const [selectedArea, setSelectedArea] = useState(() => {
    const a = authService.getArea();
    return a ? String(a.idArea) : '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Listas derivadas en el render (sin estado redundante ni efectos de sincronización)
  const sucursalesFiltradas = selectedEmpresa
    ? sucursales.filter(
        (s) => s.idSucursal != null && s.idEmpresa != null && String(s.idEmpresa) === String(selectedEmpresa)
      )
    : [];
  const areasFiltradas = selectedEmpresa
    ? areas.filter((a) => String(a.idEmpresa) === String(selectedEmpresa))
    : [];

  // Ajuste de estado durante el render (recomendado vs. setState dentro de useEffect).
  // Si la sucursal/área seleccionada no es válida para la empresa, caer al primero [0].
  if (selectedEmpresa) {
    if (
      sucursalesFiltradas.length > 0 &&
      !sucursalesFiltradas.some((s) => String(s.idSucursal) === selectedSucursal)
    ) {
      setSelectedSucursal(String(sucursalesFiltradas[0].idSucursal));
    }
    if (
      areasFiltradas.length > 0 &&
      !areasFiltradas.some((a) => String(a.idArea) === selectedArea)
    ) {
      setSelectedArea(String(areasFiltradas[0].idArea));
    }
  }

  const areaLista = areasFiltradas.length === 0 || !!selectedArea;

  // Auto-submit si el usuario no puede seleccionar empresa/sucursal (efecto: side-effect real)
  useEffect(() => {
    if (!puedeSeleccionarEmpresas && selectedEmpresa && selectedSucursal && areaLista) {
      const form = formRef.current;
      if (form) {
        // Pequeño delay para asegurar que el state está actualizado
        const timer = setTimeout(() => {
          form.requestSubmit();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [puedeSeleccionarEmpresas, selectedEmpresa, selectedSucursal, areaLista]);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [empresasData, sucursalesData, areasData] = await Promise.all([
        authService.getEmpresas(),
        authService.getSucursales(),
        authService.getAreas(),
      ]);

      setEmpresas(empresasData);
      setSucursales(sucursalesData);
      setAreas(areasData);
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

    const areasDeEmpresa = areas.filter((a) => String(a.idEmpresa) === String(selectedEmpresa));
    if (areasDeEmpresa.length > 0 && !selectedArea) {
      setError('Por favor selecciona un área');
      return;
    }

    try {
      const empresa = empresas.find(e => String(e.idEmpresa) === String(selectedEmpresa));
      const sucursal = sucursales.find(s => String(s.idSucursal) === String(selectedSucursal));
      if (!empresa || !sucursal) {
        setError('Empresa o sucursal no encontrada');
        return;
      }
      const area = areas.find((a) => String(a.idArea) === String(selectedArea)) || null;
      changeEmpresaSucursal(empresa, sucursal, area);
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
          <form ref={formRef} id="empresa-sucursal-form" onSubmit={handleSubmit} className="space-y-4">
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

            {/* Selección de Área */}
            {selectedEmpresa && !isLoading && areasFiltradas.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Área
                </label>
                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areasFiltradas.map((area) => (
                      <SelectItem key={area.idArea} value={String(area.idArea)}>
                        {area.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Botones */}
            <div className="flex flex-col gap-2">
              {puedeSeleccionarEmpresas && (
                <Button
                  type="submit"
                  disabled={
                    !selectedEmpresa ||
                    !selectedSucursal ||
                    (areasFiltradas.length > 0 && !selectedArea) ||
                    isLoading
                  }
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
