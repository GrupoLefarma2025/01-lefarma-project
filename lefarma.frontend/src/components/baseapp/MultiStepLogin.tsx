import { useState, FormEvent, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';
import { getDomainLabel } from '@/shared/auth/domains';
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
import { Lock, User, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import logoEstatico from '@/assets/logo.png';
import { StepIndicator } from '@/components/baseapp/StepIndicator';

export interface MultiStepLoginProps {
  /**
   * Destino de navegación post-login. Honrado a menos que exista un
   * `?return=` del mismo origen (guard anti open-redirect). Requerido porque
   * cada consumidor sabe a dónde debe aterrizar.
   */
  redirectTo: string;
  /**
   * Contenido del paso 3 inyectado por la app consumidora (ej. selección de
   * empresa/sucursal/área de CxP). Su presencia equivale a
   * `requireContextSelection: true`: el login cargará el paso 3 tras las
   * credenciales. Si se omite, el login es de 2 pasos y autentica al instante.
   *
   * El slot es responsable de su propio estado/formulario y de finalizar la
   * sesión escribiendo `isAuthenticated` en el authStore (típicamente vía
   * `loginStepThree`). MultiStepLogin observa ese flag y ejecuta el redirect.
   */
  step3?: ReactNode;
  /** Etiqueta del 3er punto del indicador de progreso. Default: 'Contexto'. */
  step3Label?: string;
  /** Descripción bajo el indicador cuando se muestra el paso 3. */
  step3Description?: string;
}

/**
 * Shell de autenticación multi-paso reutilizable.
 *
 * Encapsula los pasos comunes a todas las apps:
 *  1. Usuario
 *  2. Contraseña (+ selección de dominio si aplica)
 *  3. (Opcional) contenido provisto por la app via `step3`
 *
 * La navegación post-login vive aquí: cuando `isAuthenticated` pasa a `true`
 * (sea tras el paso 2 en flujos de 2 pasos, o tras el paso 3 cuando el slot
 * finaliza), se redirige a `redirectTo` o a `?return=` del mismo origen.
 *
 * Esto reemplaza la lógica de pasos 1 y 2 que antes vivía en
 * `pages/auth/Login.tsx`, dejando que cada app inyecte su propio paso 3.
 */
export function MultiStepLogin({
  redirectTo,
  step3,
  step3Label = 'Contexto',
  step3Description,
}: MultiStepLoginProps) {
  const navigate = useNavigate();
  const hasStep3 = step3 !== undefined;
  const {
    loginStep,
    availableDomains,
    requiresDomainSelection,
    displayName,
    pendingUsername,
    isLoading,
    isAuthenticated,
    loginStepOne,
    loginStepTwo,
    resetLoginFlow,
  } = useAuthStore();

  // Destino de retorno post-login opcional, establecido por el guard
  // RequireAuth del shell cuando redirige aquí una sesión no autenticada.
  // Guard contra open-redirect: solo honra rutas absolutas del mismo origen
  // (relativas a la raíz, NO relativas al protocolo como `//evil.com`).
  const [searchParams] = useSearchParams();
  const returnSearchParam = searchParams.get('return');
  const safeReturn =
    returnSearchParam &&
    returnSearchParam.startsWith('/') &&
    !returnSearchParam.startsWith('//')
      ? returnSearchParam
      : null;

  const [username, setUsername] = useState(() => pendingUsername ?? '');
  const [password, setPassword] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [error, setError] = useState('');

  // Detectar el regreso desde el paso 3 (el slot llamó `resetLoginFlow`) al
  // paso 1 para limpiar credenciales locales. Preserva el comportamiento del
  // Login original. Se excluye el caso de éxito del paso 3 (loginStepThree
  // setea loginStep=1 e isAuthenticated=true) para no limpiar durante la
  // navegación de salida.
  //
  // Patrón de ajuste de estado durante el render (documentado por React)
  // ante el cambio de un valor externo: evita setState en effects
  // (react-hooks/set-state-in-effect) y el acceso a refs durante el render
  // (react-hooks/refs).
  const [prevLoginStep, setPrevLoginStep] = useState(loginStep);
  if (loginStep !== prevLoginStep) {
    setPrevLoginStep(loginStep);
    if (prevLoginStep === 3 && loginStep === 1 && !isAuthenticated) {
      setPassword('');
      setSelectedDomain('');
      setUsername('');
    }
  }

  // Auto-seleccionar el dominio cuando hay uno solo (mismo patrón de
  // ajuste durante el render).
  if (!requiresDomainSelection && availableDomains.length === 1 && !selectedDomain) {
    setSelectedDomain(availableDomains[0]);
  }

  // Navegación al destino post-login: lado-effecto real, va en efecto.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (safeReturn) {
      navigate(safeReturn, { replace: true });
      return;
    }
    navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, safeReturn, redirectTo]);

  const handleStepOne = useCallback(
    async (e: FormEvent) => {
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
    },
    [username, loginStepOne]
  );

  const handleStepTwo = useCallback(
    async (e: FormEvent) => {
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
        // La presencia de step3 determina si se requiere selección de contexto:
        // el store carga empresas/sucursales/areas y avanza al paso 3, o
        // finaliza la sesión aquí (flujo de 2 pasos).
        await loginStepTwo(password, domain, { requireContextSelection: hasStep3 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Credenciales incorrectas';
        setError(message);
      }
    },
    [password, selectedDomain, requiresDomainSelection, availableDomains, hasStep3, loginStepTwo]
  );

  const handleBack = useCallback(() => {
    resetLoginFlow();
    setUsername('');
    setPassword('');
    setSelectedDomain('');
    setError('');
  }, [resetLoginFlow]);

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
          <StepIndicator
            steps={hasStep3 ? ['Usuario', 'Contraseña', step3Label] : ['Usuario', 'Contraseña']}
            current={loginStep}
          />

          <CardDescription>
            {loginStep === 1 && 'Ingresa tu nombre de usuario'}
            {loginStep === 2 && 'Completa tu autenticación'}
            {loginStep === 3 && (step3Description ?? '')}
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
                          {getDomainLabel(domain)}
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
                    Dominio: {getDomainLabel(availableDomains[0])}
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

          {/* PASO 3: contenido inyectado por la app consumidora */}
          {loginStep === 3 && step3}

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Versión {import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
