import { useState, FormEvent, useMemo } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, ArrowLeft, Building2, Building, MapPin } from 'lucide-react';

/**
 * Paso 3 de selección de contexto (empresa/sucursal/área) para CxP — la ÚNICA
 * app que recopila contexto antes de finalizar la sesión.
 *
 * Se renderiza como slot `step3` de `<MultiStepLogin>`. Su única
 * responsabilidad es recolectar la ubicación y finalizar la sesión vía
 * `loginStepThree` (que escribe `isAuthenticated` en el store). La navegación
 * post-login la maneja MultiStepLogin.
 *
 * El botón "Volver" llama `resetLoginFlow()`; MultiStepLogin detecta la
 * transición de paso 3 → 1 y limpia las credenciales locales, y este componente
 * se desmonta descartando su propio estado.
 */
export function CxpContextSelection() {
  const {
    displayName,
    empresas,
    sucursales,
    areas,
    puedeSeleccionarEmpresas,
    usuarioDetalle,
    isLoading,
    loginStepThree,
    resetLoginFlow,
  } = useAuthStore();

  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [error, setError] = useState('');

  // Auto-selección cuando el usuario NO puede cambiar empresa/sucursal
  const autoSelectedEmpresa = useMemo(() => {
    if (puedeSeleccionarEmpresas || !usuarioDetalle) return null;
    const { idEmpresa } = usuarioDetalle;
    if (idEmpresa > 0) return String(idEmpresa);
    return null;
  }, [puedeSeleccionarEmpresas, usuarioDetalle]);

  const autoSelectedSucursal = useMemo(() => {
    if (puedeSeleccionarEmpresas || !usuarioDetalle) return null;
    const { idSucursal } = usuarioDetalle;
    const empresaId = autoSelectedEmpresa;
    if (!empresaId) return null;
    const sucursalesDeEmpresa = sucursales.filter((s) => String(s.idEmpresa) === empresaId);
    if (idSucursal > 0) {
      const existe = sucursalesDeEmpresa.some((s) => String(s.idSucursal) === String(idSucursal));
      if (existe) return String(idSucursal);
    }
    if (sucursalesDeEmpresa.length === 1) {
      return String(sucursalesDeEmpresa[0].idSucursal);
    }
    return null;
  }, [puedeSeleccionarEmpresas, usuarioDetalle, autoSelectedEmpresa, sucursales]);

  const autoSelectedArea = useMemo(() => {
    if (puedeSeleccionarEmpresas || !usuarioDetalle) return null;
    const { idArea } = usuarioDetalle;
    if (idArea && idArea > 0) {
      const existe = areas.some((a) => String(a.idArea) === String(idArea));
      if (existe) return String(idArea);
    }
    return null;
  }, [puedeSeleccionarEmpresas, usuarioDetalle, areas]);

  // Valores efectivos: auto-selección o los del usuario
  const effectiveEmpresa = autoSelectedEmpresa ?? selectedEmpresa;
  const effectiveSucursal = autoSelectedSucursal ?? selectedSucursal;
  const effectiveArea = autoSelectedArea ?? selectedArea;

  const sucursalesFiltradas = sucursales.filter((s) => {
    if (!s.idSucursal || s.idSucursal === undefined) return false;
    if (!s.idEmpresa || s.idEmpresa === undefined) return false;
    return String(s.idEmpresa) === String(effectiveEmpresa);
  });

  const areasFiltradas = useMemo(() => {
    return areas.filter((a) => {
      if (!a.idArea) return false;
      return String(a.idEmpresa) === String(effectiveEmpresa);
    });
  }, [areas, effectiveEmpresa]);

  // --- Ajustes de estado durante el render (recomendado vs. setState en useEffect) ---

  // Pre-cargar empresa/sucursal/area del usuario como DEFAULT cuando puede seleccionar
  // (cuando no puede, ya se resuelven via autoSelected*). Editable: solo siembra valores.
  if (puedeSeleccionarEmpresas && usuarioDetalle && !selectedEmpresa) {
    if (usuarioDetalle.idEmpresa > 0) setSelectedEmpresa(String(usuarioDetalle.idEmpresa));
    if (usuarioDetalle.idSucursal > 0) setSelectedSucursal(String(usuarioDetalle.idSucursal));
    if (usuarioDetalle.idArea && usuarioDetalle.idArea > 0) setSelectedArea(String(usuarioDetalle.idArea));
  }

  // Si no hay un área válida para la empresa elegida, caer al primero [0] (no dejar vacío)
  if (
    effectiveEmpresa &&
    areasFiltradas.length > 0 &&
    !areasFiltradas.some((a) => String(a.idArea) === effectiveArea)
  ) {
    setSelectedArea(String(areasFiltradas[0].idArea));
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const emp = effectiveEmpresa || selectedEmpresa;
    const suc = effectiveSucursal || selectedSucursal;
    const ar = effectiveArea || selectedArea;

    if (!emp) {
      setError('Por favor selecciona una empresa');
      return;
    }

    if (!suc) {
      setError('Por favor selecciona una sucursal');
      return;
    }

    if (areasFiltradas.length > 0 && !ar) {
      setError('Por favor selecciona un área');
      return;
    }

    try {
      // loginStepThree escribe isAuthenticated=true en el store; MultiStepLogin
      // observa ese flag y ejecuta el redirect. No se navega aquí.
      await loginStepThree(emp, suc, ar);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al seleccionar ubicación';
      setError(message);
    }
  };

  const empresaSeleccionada = empresas.find((e) => String(e.idEmpresa) === String(selectedEmpresa));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {displayName && (
        <div className="bg-primary/10 rounded-lg px-4 py-2 text-center text-primary">
          <p className="text-sm font-medium">Bienvenido, {displayName}</p>
          <p className="text-xs text-muted-foreground">
            Selecciona la ubicación desde la cual generarás órdenes de compra
          </p>
        </div>
      )}

      {/* Empresa */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4" />
          Empresa
        </label>
        <Select
          value={effectiveEmpresa || selectedEmpresa}
          onValueChange={(val) => {
            setSelectedEmpresa(val);
            setSelectedSucursal('');
            setSelectedArea('');
          }}
          disabled={!puedeSeleccionarEmpresas}
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

      {/* Sucursal */}
      {(effectiveEmpresa || selectedEmpresa) && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Building className="h-4 w-4" />
            Sucursal
            {empresaSeleccionada && (
              <span className="font-normal text-muted-foreground">
                - {empresaSeleccionada.nombre}
              </span>
            )}
          </label>
          <Select
            value={effectiveSucursal || selectedSucursal}
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

      {/* Área */}
      {(effectiveEmpresa || selectedEmpresa) && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" />
            Área
          </label>
          {areasFiltradas.length > 0 ? (
            <Select
              value={effectiveArea || selectedArea}
              onValueChange={setSelectedArea}
              disabled={areasFiltradas.length === 0}
            >
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
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No hay áreas disponibles para esta empresa.
            </p>
          )}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          !(effectiveEmpresa || selectedEmpresa) ||
          !(effectiveSucursal || selectedSucursal) ||
          (areasFiltradas.length > 0 && !(effectiveArea || selectedArea)) ||
          isLoading
        }
      >
        {isLoading ? 'Procesando...' : 'Iniciar Sesión'}
      </Button>

      <button
        type="button"
        onClick={() => {
          resetLoginFlow();
          setError('');
        }}
        className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        disabled={isLoading}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>
    </form>
  );
}
