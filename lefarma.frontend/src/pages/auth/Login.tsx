import { useState, FormEvent, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
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
    puedeSeleccionarEmpresas,
    usuarioDetalle,
    loginStepOne,
    loginStepTwo,
    loginStepThree,
    resolveArea,
    resetLoginFlow,
  } = useAuthStore();

  const [username, setUsername] = useState(pendingUsername || '');
  const [syncedPending, setSyncedPending] = useState<string | null>(pendingUsername || null);
  const [password, setPassword] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [error, setError] = useState('');
  // Evita doble auto-commit del paso 3 (StrictMode monta efectos dos veces) — patrón HandoffLogin
  const ranRef = useRef(false);
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
  const effectiveEmpresa = autoSelectedEmpresa ?? selectedEmpresa;
  const effectiveSucursal = autoSelectedSucursal ?? selectedSucursal;

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
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

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
      return;
    }
    if (puedeSeleccionarEmpresas) return;
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
