import { useState, FormEvent, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Lock,
  User,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Building2,
  Building,
} from 'lucide-react';
import logoEstatico from '@/assets/logo.png';

/**
 * @legacy Login monolítico — SUPERSEDO por `<MultiStepLogin>` (pasos 1 y 2)
 * más el slot `step3` inyectado por cada app (ej. `CxpContextSelection` para
 * CxP). La fábrica genérica `createAppRoutes` ahora renderiza `<MultiStepLogin>`
 * en lugar de este componente.
 *
 * Se conserva ÍNTEGRO (sin cambios de lógica) únicamente porque sus pruebas
 * unitarias directas (`require-auth.test.tsx`, `login.smoke.test.tsx`) lo
 * importan y ejercen. No agregar nuevos consumidores — usar
 * `<MultiStepLogin>` + slot `step3` para cualquier login nuevo.
 */

const DOMAIN_NAMES: Record<string, string> = {
  'LEFARMA-HN': 'LeFarma Honduras',
  'LEFARMA-GT': 'LeFarma Guatemala',
  'LEFARMA-SV': 'LeFarma El Salvador',
  'LEFARMA-NI': 'LeFarma Nicaragua',
  'LEFARMA-CR': 'LeFarma Costa Rica',
  DC: 'Distribuidora Central',
};

export interface LoginProps {
  /**
   * Cuando es `true` (por defecto), presenta el flujo de 3 pasos que recopila
   * el contexto de empresa/sucursal/area después de las credenciales (login
   * CxP — CxP es la ÚNICA app que recopila contexto). Cuando es `false`, la
   * sesión se finaliza justo después de las credenciales y el paso de selección
   * de contexto se omite limpiamente (flujo `/login` global y el login por-app
   * de RH).
   */
  requireContextSelection?: boolean;
  /**
   * Destino de navegación post-login. Por defecto `'dashboard'` (el landing
   * de CxP). El login global lo sobrescribe con `'/hub'`.
   */
  redirectTo?: string;
}

export default function Login({
  requireContextSelection = true,
  redirectTo = 'dashboard',
}: LoginProps = {}) {
  const navigate = useNavigate();
  const {
    loginStep,
    availableDomains,
    requiresDomainSelection,
    displayName,
    pendingUsername,
    isLoading,
    isAuthenticated,
    empresas,
    sucursales,
    puedeSeleccionarEmpresas,
    usuarioDetalle,
    profileError,
    loginStepOne,
    loginStepTwo,
    loginStepThree,
    resolveArea,
    resetLoginFlow,
    loadProfile,
  } = useAuthStore();

  // Destino de retorno post-login opcional, establecido por el guard
  // RequireAuth del shell cuando redirige aquí una sesión no autenticada.
  // Guarda contra open-redirect: solo honra rutas absolutas del mismo origen
  // (relativas a la raíz, NO relativas al protocolo como `//evil.com`). El
  // shell ahora se sirve desde la raíz (`/`), así que los destinos de retorno
  // válidos se ven como `/hub`, `/perfil`, `/cxp/dashboard`, `/rh/dashboard`, etc.
  // El flujo por defecto de CxP (sin parámetro return) no cambia.
  const returnSearchParam = new URLSearchParams(window.location.search).get('return');
  const safeReturn =
    returnSearchParam &&
    returnSearchParam.startsWith('/') &&
    !returnSearchParam.startsWith('//')
      ? returnSearchParam
      : null;

  const [username, setUsername] = useState(pendingUsername || '');
  const [syncedPending, setSyncedPending] = useState<string | null>(pendingUsername || null);
  const [password, setPassword] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [error, setError] = useState('');
  // Evita doble auto-commit del paso 3 (StrictMode monta efectos dos veces) — patrón HandoffLogin
  const ranRef = useRef(false);
  // Selección manual del usuario en el paso 3: bloquea el auto-commit y la auto-selección.
  // No se resetea al reintentar el profile a propósito: la elección manual sobrevive al retry.
  // Se limpia solo al salir del paso 3 (submit o volver).
  const manualSelectionRef = useRef(false);
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

  // Valores efectivos: auto-selección o los del usuario
  // (si hubo selección manual en este paso, la auto-selección cede ante ella)
  const effectiveEmpresa = manualSelectionRef.current ? selectedEmpresa : autoSelectedEmpresa ?? selectedEmpresa;
  const effectiveSucursal = manualSelectionRef.current ? selectedSucursal : autoSelectedSucursal ?? selectedSucursal;

  const sucursalesFiltradas = sucursales.filter((s) => {
    if (!s.idSucursal || s.idSucursal === undefined) return false;
    if (!s.idEmpresa || s.idEmpresa === undefined) return false;
    return String(s.idEmpresa) === String(effectiveEmpresa);
  });

  // --- Ajustes de estado durante el render (recomendado vs. setState dentro de useEffect) ---

  // Sincronizar username cuando el store cambia pendingUsername (sin pisar lo que el usuario tipea)
  if (pendingUsername && pendingUsername !== syncedPending) {
    setSyncedPending(pendingUsername);
    setUsername(pendingUsername);
  }

  // Auto-seleccionar el dominio cuando hay uno solo
  if (!requiresDomainSelection && availableDomains.length === 1 && !selectedDomain) {
    setSelectedDomain(availableDomains[0]);
  }

  // Pre-cargar empresa/sucursal/area del usuario como DEFAULT cuando puede seleccionar
  // (cuando no puede, ya se resuelven via autoSelected*). Editable: solo siembra valores.
  if (loginStep === 3 && puedeSeleccionarEmpresas && usuarioDetalle && !selectedEmpresa) {
    if (usuarioDetalle.idEmpresa > 0) setSelectedEmpresa(String(usuarioDetalle.idEmpresa));
    if (usuarioDetalle.idSucursal > 0) setSelectedSucursal(String(usuarioDetalle.idSucursal));
  }

  // Navegacion al dashboard: side-effect real, va en efecto
  useEffect(() => {
    if (!isAuthenticated) return;
    // Honrar un destino de retorno del mismo origen si existe; de lo contrario
    // usar el redirect configurado (dashboard de CxP o /hub para el login global).
    if (safeReturn) {
      navigate(safeReturn, { replace: true });
      return;
    }
    navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, safeReturn, redirectTo]);

  // Área resuelta por la regla única (REQ-001): solo lectura, nunca un control (REQ-004/007)
  const resolvedArea = useMemo(() => {
    const empId = effectiveEmpresa || selectedEmpresa;
    if (!empId) return null;
    return resolveArea(empId);
  }, [effectiveEmpresa, selectedEmpresa, resolveArea]);

  // Auto-commit del paso 3 SOLO cuando el usuario no puede elegir empresa/sucursal
  // (puedeSeleccionarEmpresas=false) y el detalle resuelve contexto válido (REQ-004).
  // Cuando puede seleccionar, el paso 3 se muestra con defaults del detalle (prefill abajo)
  // y el usuario confirma o cambia — el salto lo dejaría a medias sin chance de cambiar.
  // ranRef: mismo patrón que HandoffLogin — StrictMode monta efectos dos veces en dev; evita
  // el doble commit. Se rearma al salir del paso 3 para permitir re-login en el mismo mount.
  useEffect(() => {
    if (loginStep !== 3) {
      ranRef.current = false;
      manualSelectionRef.current = false;
      return;
    }
    if (puedeSeleccionarEmpresas) return;
    if (manualSelectionRef.current) return;
    if (ranRef.current || isLoading || isAuthenticated) return;
    if (!usuarioDetalle || usuarioDetalle.idEmpresa <= 0 || usuarioDetalle.idSucursal <= 0) return;

    const empId = String(usuarioDetalle.idEmpresa);
    const sucId = String(usuarioDetalle.idSucursal);
    const empValida = empresas.some((e) => String(e.idEmpresa) === empId);
    const sucValida = sucursales.some(
      (s) => String(s.idEmpresa) === empId && String(s.idSucursal) === sucId
    );
    if (!empValida || !sucValida) return;
    if (!resolveArea(empId)) return;

    ranRef.current = true;
    void loginStepThree(empId, sucId);
  }, [loginStep, puedeSeleccionarEmpresas, isLoading, isAuthenticated, usuarioDetalle, empresas, sucursales, resolveArea, loginStepThree]);

  const handleStepOne = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Por favor ingresa tu nombre de usuario');
      return;
    }

    try {
      await loginStepOne(username.trim());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Usuario no encontrado';
      setError(message);
    }
  };

  const handleStepTwo = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Por favor ingresa tu contraseña');
      return;
    }

    if (requiresDomainSelection && !selectedDomain) {
      setError('Por favor selecciona un dominio');
      return;
    }

    const domain = requiresDomainSelection ? selectedDomain : availableDomains[0];

    try {
      await loginStepTwo(password, domain, { requireContextSelection });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Credenciales incorrectas';
      setError(message);
    }
  };

  const handleStepThree = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const emp = effectiveEmpresa || selectedEmpresa;
    const suc = effectiveSucursal || selectedSucursal;

    if (!emp) {
      setError('Por favor selecciona una empresa');
      return;
    }

    if (!suc) {
      setError('Por favor selecciona una sucursal');
      return;
    }

    try {
      await loginStepThree(emp, suc);
      // Honrar un destino de retorno del mismo origen si existe; de lo contrario
      // usar el redirect configurado (dashboard de CxP).
      if (safeReturn) {
        navigate(safeReturn, { replace: true });
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al seleccionar ubicación';
      setError(message);
    }
  };

  const handleBack = () => {
    if (loginStep === 3) {
      resetLoginFlow();
      setUsername('');
      setPassword('');
      setSelectedDomain('');
      setSelectedEmpresa('');
      setSelectedSucursal('');
    } else {
      resetLoginFlow();
    }
    setError('');
  };

  const empresaSeleccionada = empresas.find((e) => String(e.idEmpresa) === String(selectedEmpresa));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-2 flex justify-center">
            <img
              src={logoEstatico}
              alt="Grupo LeFarma"
              style={{ width: '100%', maxWidth: '300px', height: 'auto' }}
            />
          </div>

          {/* Pasos de progreso */}
          <div className="my-4 flex items-center justify-center gap-2">
            <div
              className={`flex items-center gap-2 ${
                loginStep >= 1 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  loginStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {loginStep > 1 ? <CheckCircle className="h-4 w-4" /> : '1'}
              </div>
              <span className="hidden text-sm font-medium sm:inline">Usuario</span>
            </div>

            <div className={`h-0.5 w-6 ${loginStep > 1 ? 'bg-primary' : 'bg-muted'}`} />

            <div
              className={`flex items-center gap-2 ${
                loginStep >= 2 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  loginStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {loginStep > 2 ? <CheckCircle className="h-4 w-4" /> : '2'}
              </div>
              <span className="hidden text-sm font-medium sm:inline">Contraseña</span>
            </div>

            <div className={`h-0.5 w-6 ${loginStep > 2 ? 'bg-primary' : 'bg-muted'}`} />

            <div
              className={`flex items-center gap-2 ${
                loginStep >= 3 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  loginStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                3
              </div>
              <span className="hidden text-sm font-medium sm:inline">Ubicación</span>
            </div>
          </div>

          <CardDescription>
            {loginStep === 1 && 'Ingresa tu nombre de usuario'}
            {loginStep === 2 && 'Completa tu autenticación'}
            {loginStep === 3 && 'Selecciona la ubicación desde la cual generarás órdenes de compra'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* PASO 1: Usuario */}
          {loginStep === 1 && (
            <form onSubmit={handleStepOne} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de Usuario</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Buscando...' : 'Continuar'}
              </Button>
            </form>
          )}

          {/* PASO 2: Contraseña y Dominio */}
          {loginStep === 2 && (
            <form onSubmit={handleStepTwo} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {displayName && (
                <div className="rounded-lg bg-muted px-4 py-2 text-center">
                  <p className="text-sm text-muted-foreground">Hola,</p>
                  <p className="font-medium">{displayName}</p>
                </div>
              )}

              {requiresDomainSelection && availableDomains.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seleccionar Dominio</label>
                  <Select
                    value={selectedDomain}
                    onValueChange={setSelectedDomain}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un dominio" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDomains.map((domain, index) => (
                        <SelectItem key={domain || `domain-${index}`} value={domain || ''}>
                          {DOMAIN_NAMES[domain] || domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!requiresDomainSelection && availableDomains.length === 1 && (
                <div className="bg-primary/10 flex items-center gap-2 rounded-lg p-3 text-primary">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">
                    Dominio: {DOMAIN_NAMES[availableDomains[0]] || availableDomains[0]}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Verificando...' : 'Continuar'}
              </Button>

              <button
                type="button"
                onClick={handleBack}
                className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" />
                Usar otro usuario
              </button>
            </form>
          )}

          {/* PASO 3: Empresa, Sucursal y Área */}
          {loginStep === 3 && (
            <form id="empresa-sucursal-form" onSubmit={handleStepThree} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {profileError && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{profileError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadProfile()}
                    className="shrink-0 text-sm font-medium underline underline-offset-2"
                  >
                    Reintentar
                  </button>
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
                    manualSelectionRef.current = true;
                    setSelectedEmpresa(val);
                    setSelectedSucursal('');
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
                    onValueChange={(val) => {
                      manualSelectionRef.current = true;
                      setSelectedSucursal(val);
                    }}
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

              {/* Área — solo lectura, asignada por administración (REQ-004/007) */}
              {(effectiveEmpresa || selectedEmpresa) && resolvedArea && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Área</label>
                  <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                    {resolvedArea.nombre}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  !(effectiveEmpresa || selectedEmpresa) ||
                  !(effectiveSucursal || selectedSucursal) ||
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
          )}

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Versión {import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
