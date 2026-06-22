import { useState, FormEvent, useEffect, useMemo } from 'react';
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
  MapPin,
} from 'lucide-react';
import logoEstatico from '@/assets/logo.png';

const DOMAIN_NAMES: Record<string, string> = {
  'LEFARMA-HN': 'LeFarma Honduras',
  'LEFARMA-GT': 'LeFarma Guatemala',
  'LEFARMA-SV': 'LeFarma El Salvador',
  'LEFARMA-NI': 'LeFarma Nicaragua',
  'LEFARMA-CR': 'LeFarma Costa Rica',
  DC: 'Distribuidora Central',
};

export default function Login() {
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
    areas,
    puedeSeleccionarEmpresas,
    usuarioDetalle,
    loginStepOne,
    loginStepTwo,
    loginStepThree,
    resetLoginFlow,
  } = useAuthStore();

  // Optional post-login return target, set by the `/CxP/` shell's RequireAuth
  // guard when it redirects an unauthenticated session here. Open-redirect guard:
  // only honor return paths scoped to the `/CxP/` prefix (the shell build). The
  // default Gastos flow (no return param) is unchanged.
  const returnSearchParam = new URLSearchParams(window.location.search).get('return');
  const safeReturn =
    returnSearchParam && returnSearchParam.startsWith('/CxP/') ? returnSearchParam : null;

  const [username, setUsername] = useState(pendingUsername || '');
  const [syncedPending, setSyncedPending] = useState<string | null>(pendingUsername || null);
  const [password, setPassword] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
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
    if (usuarioDetalle.idArea && usuarioDetalle.idArea > 0) setSelectedArea(String(usuarioDetalle.idArea));
  }

  // Si no hay un área válida para la empresa elegida, caer al primero [0] (no dejar vacío)
  if (
    loginStep === 3 &&
    effectiveEmpresa &&
    areasFiltradas.length > 0 &&
    !areasFiltradas.some((a) => String(a.idArea) === effectiveArea)
  ) {
    setSelectedArea(String(areasFiltradas[0].idArea));
  }

  // Navegacion al dashboard: side-effect real, va en efecto
  useEffect(() => {
    if (!isAuthenticated) return;
    // Honor a `/CxP/`-scoped return target if present; otherwise default to Gastos.
    if (safeReturn) {
      window.location.href = safeReturn;
      return;
    }
    navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate, safeReturn]);

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
      await loginStepTwo(password, domain);
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
      await loginStepThree(emp, suc, ar);
      // Honor a `/CxP/`-scoped return target if present; otherwise default to Gastos.
      if (safeReturn) {
        window.location.href = safeReturn;
        return;
      }
      navigate('/dashboard', { replace: true });
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
      setSelectedArea('');
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

          {/* Progress steps */}
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
          )}

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Versión {import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
