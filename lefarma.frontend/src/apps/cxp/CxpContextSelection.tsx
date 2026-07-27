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
 * Slot `step3` de `<MultiStepLogin>` para CxP — selección de empresa, sucursal
 * y área. Es la presencia de este slot lo que dispara el flujo de 3 pasos del
 * login de CxP (cxp-app spec: contexto de órdenes de compra).
 *
 * Extracción del antiguo paso 3 del monolito `pages/auth/Login.tsx`: conserva
 * la misma estructura de formulario, la misma lógica de auto-selección (cuando
 * el usuario NO puede seleccionar empresas) y el mismo filtrado de sucursales y
 * áreas por empresa efectiva.
 *
 * CONTRATO CRÍTICO — el slot NO navega. Al enviar el formulario, llama
 * `loginStepThree(emp, suc, ar)` que escribe `isAuthenticated: true` en el
 * authStore (verificado en `shared/auth/authStore.ts`). `<MultiStepLogin>`
 * observa ese flag y ejecuta el redirect a `?return=` o al destino configurado
 * (`dashboard`). Cualquier `navigate(...)` aquí duplicaría/competiría con el
 * redirect del shell.
 *
 * El slot es responsable exclusivamente de su estado de selección (empresa,
 * sucursal, área) y del banner de bienvenida/error; el chrome (logo, indicador
 * de pasos, fields de usuario/contraseña) vive en `<MultiStepLogin>`.
 */
export function CxpContextSelection() {
  const {
    empresas,
    sucursales,
    areas,
    puedeSeleccionarEmpresas,
    usuarioDetalle,
    displayName,
    isLoading,
    loginStepThree,
    resetLoginFlow,
  } = useAuthStore();

  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [error, setError] = useState('');

  // Auto-selección cuando el usuario NO puede cambiar empresa/sucursal/área.
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

  // Valores efectivos: auto-selección o los del usuario.
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

  // --- Ajustes de estado durante el render (recomendado vs. setState dentro de useEffect) ---

  // Pre-cargar empresa/sucursal/área del usuario como DEFAULT cuando puede
  // seleccionar (cuando no puede, ya se resuelven vía autoSelected*). Solo
  // siembra valores editables; este slot solo se monta en loginStep === 3.
  if (puedeSeleccionarEmpresas && usuarioDetalle && !selectedEmpresa) {
    if (usuarioDetalle.idEmpresa > 0) setSelectedEmpresa(String(usuarioDetalle.idEmpresa));
    if (usuarioDetalle.idSucursal > 0) setSelectedSucursal(String(usuarioDetalle.idSucursal));
    if (usuarioDetalle.idArea && usuarioDetalle.idArea > 0) setSelectedArea(String(usuarioDetalle.idArea));
  }

  // Si no hay un área válida para la empresa elegida, caer al primero [0]
  // (no dejar vacío).
  if (
    effectiveEmpresa &&
    areasFiltradas.length > 0 &&
    !areasFiltradas.some((a) => String(a.idArea) === effectiveArea)
  ) {
    setSelectedArea(String(areasFiltradas[0].idArea));
  }

  const handleStepThree = async (e: FormEvent) => {
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
      // Finaliza la sesión escribiendo `isAuthenticated: true` en el store.
      // NO se navega aquí: `<MultiStepLogin>` observa `isAuthenticated` y
      // ejecuta el redirect a `?return=` o `dashboard`.
      await loginStepThree(emp, suc, ar);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al seleccionar ubicación';
      setError(message);
    }
  };

  const handleBack = () => {
    resetLoginFlow();
    setSelectedEmpresa('');
    setSelectedSucursal('');
    setSelectedArea('');
    setError('');
  };

  const empresaSeleccionada = empresas.find((e) => String(e.idEmpresa) === String(selectedEmpresa));

  return (
    <form id="empresa-sucursal-form" onSubmit={handleStepThree} className="space-y-4">
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
        onClick={handleBack}
        className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        disabled={isLoading}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>
    </form>
  );
}
