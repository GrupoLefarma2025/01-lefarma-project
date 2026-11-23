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
import { PageLoader } from '@/components/ui/page-loader';

export interface MultiStepLoginProps {
  redirectTo: string;
  step3?: ReactNode;
  step3Label?: string;
  step3Description?: string;
  subtitle?: string;
  appName?: string;
}

export function MultiStepLogin({
  redirectTo,
  step3,
  step3Label = 'Contexto',
  step3Description,
  subtitle,
  appName,
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
    isInitialized,
    loginStepOne,
    loginStepTwo,
    resetLoginFlow,
  } = useAuthStore();

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

  const [prevLoginStep, setPrevLoginStep] = useState(loginStep);
  if (loginStep !== prevLoginStep) {
    setPrevLoginStep(loginStep);
    if (prevLoginStep === 3 && loginStep === 1 && !isAuthenticated) {
      setPassword('');
      setSelectedDomain('');
      setUsername('');
    }
  }

  if (!requiresDomainSelection && availableDomains.length === 1 && !selectedDomain) {
    setSelectedDomain(availableDomains[0]);
  }

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

  if (!isInitialized || isAuthenticated) return <PageLoader />;

  return (
    <div
      className={
        appName
          ? 'flex min-h-screen items-center justify-center bg-background p-4'
          : 'relative flex min-h-screen items-center justify-center overflow-hidden p-4'
      }
      style={
        appName
          ? undefined
          : {
              background:
                'linear-gradient(to bottom right, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--primary) 5%, transparent) 50%, color-mix(in srgb, var(--primary) 30%, transparent))',
            }
      }
    >
      {}
      {!appName && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl"
            style={{ background: 'color-mix(in srgb, var(--primary) 30%, transparent)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full blur-3xl"
            style={{ background: 'color-mix(in srgb, var(--primary) 25%, transparent)' }}
          />
        </>
      )}
      <Card
        className={appName ? 'w-full max-w-md shadow-xl' : 'w-full max-w-md shadow-xl backdrop-blur-xl'}
        style={
          appName
            ? undefined
            : { backgroundColor: 'color-mix(in srgb, var(--card) 60%, transparent)' }
        }
      >
        <CardHeader className="space-y-1 text-center">
          <div className="mb-2 flex justify-center">
            <img
              src={logoEstatico}
              alt="Grupo LeFarma"
              style={{ width: '100%', maxWidth: '300px', height: 'auto' }}
            />
          </div>

          {subtitle && (
            <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {subtitle}
            </p>
          )}

          {}
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
          {}
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

          {}
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

          {}
          {loginStep === 3 && step3}

          <div className="relative mt-6 text-center text-sm text-gray-600">
            {appName && (
              <p className="absolute right-0 bottom-0 font-medium text-foreground/70">
                {appName}
              </p>
            )}
            <p>Versión {import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
