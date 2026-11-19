import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSigmaAuth } from '@/apps/sigma/store/sigmaAuth';
import { useAuthStore } from '@/shared/auth/authStore';
import coverImg from '@/apps/sigma/assets/logo.png';

/**
 * Entrada pública de SIGMA.
 *
 * Reproduce la pantalla de acceso de SIGMA (portada, usuario, dominio,
 * contraseña y acceso anónimo) sobre la autenticación real de Lefarma: los dos
 * pasos se ejecutan aquí mismo con `loginStepOne` / `loginStepTwo`, sin
 * credenciales propias del módulo.
 *
 * La estructura y las clases son las de `my-app/app/routes/login.tsx`, incluido
 * el modo compacto (pantallas de menos de 800 px de alto o 480 px de ancho),
 * para que se vea igual que el login original.
 */
export default function EntradaSigma() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSigmaAuth();

  const isInitialized = useAuthStore((state) => state.isInitialized);
  const loginStep = useAuthStore((state) => state.loginStep);
  const pendingUsername = useAuthStore((state) => state.pendingUsername);
  const displayName = useAuthStore((state) => state.displayName);
  const availableDomains = useAuthStore((state) => state.availableDomains);
  const requiresDomainSelection = useAuthStore((state) => state.requiresDomainSelection);
  const loginStepOne = useAuthStore((state) => state.loginStepOne);
  const loginStepTwo = useAuthStore((state) => state.loginStepTwo);
  const resetLoginFlow = useAuthStore((state) => state.resetLoginFlow);

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [dominio, setDominio] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const updateViewportMode = () => {
      setIsCompactViewport(window.innerHeight < 800 || window.innerWidth < 480);
    };
    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    window.addEventListener('orientationchange', updateViewportMode);
    return () => {
      window.removeEventListener('resize', updateViewportMode);
      window.removeEventListener('orientationchange', updateViewportMode);
    };
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/SIGMA/home" replace />;
  }

  const paso = loginStep === 2 ? 2 : 1;

  // Mismas medidas que el login de SIGMA según el tamaño del viewport.
  const controlSizeClass = isCompactViewport ? 'h-9 text-sm' : 'h-12 text-base';
  const buttonSizeClass = isCompactViewport ? 'h-10 text-sm' : 'h-12 text-base';
  const formSpacingClass = isCompactViewport ? 'space-y-3' : 'space-y-5';
  const cardBodyPadding = isCompactViewport ? 'p-3' : 'p-6';
  const headerTitleClass = isCompactViewport ? 'text-base' : 'text-xl';
  const subheaderTextClass = isCompactViewport ? 'text-xs' : 'text-sm';
  const infoTextClass = isCompactViewport ? 'text-[11px]' : 'text-xs';
  const footerTextClass = isCompactViewport ? 'text-[11px]' : 'text-sm';
  const cardMaxHeightClass = isCompactViewport
    ? 'max-h-[calc(100svh-0.5rem)]'
    : 'max-h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-3rem)]';
  const coverPaddingClass = isCompactViewport ? 'px-2 py-1' : 'px-4 py-3';
  const coverMaxHeight = isCompactViewport ? '120px' : 'min(32vh, 260px)';

  const handleStepOne = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = usuario.trim();

    if (!username) {
      setError('Ingresa tu usuario corporativo.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await loginStepOne(username);
      setUsuario(username);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'No pudimos validar el usuario. Inténtalo de nuevo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepTwo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password.trim()) {
      setError('Ingresa tu contraseña.');
      return;
    }

    const dominioElegido = requiresDomainSelection ? dominio : (availableDomains[0] ?? '');

    if (requiresDomainSelection && !dominioElegido) {
      setError('Selecciona un dominio.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await loginStepTwo(password, dominioElegido, { requireContextSelection: false });
      navigate('/SIGMA/home');
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Credenciales incorrectas.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    resetLoginFlow();
    setPassword('');
    setDominio('');
    setError('');
  };

  const usuarioVisible = usuario || pendingUsername || '';
  const nombreDominio = displayName || usuarioVisible;

  return (
    <div
      className={`relative flex min-h-[100svh] items-center justify-center bg-gradient-to-br from-background to-muted/30 ${
        isCompactViewport ? 'px-2 py-2' : 'px-4 py-6 sm:py-8'
      }`}
    >
      <div
        className={`flex w-full max-w-sm flex-col overflow-hidden rounded-xl border bg-card/85 shadow-2xl backdrop-blur sm:max-w-md lg:max-w-lg ${cardMaxHeightClass}`}
      >
        {/* Portada: mismo tratamiento que en SIGMA */}
        <div className={`flex w-full items-center justify-center bg-white dark:bg-white ${coverPaddingClass}`}>
          <div
            className="flex w-full items-center justify-center overflow-hidden rounded-xl shadow-md dark:shadow-xl"
            style={{ maxHeight: coverMaxHeight }}
          >
            <img
              src={coverImg}
              alt="Grupo Lefarma"
              className="h-auto w-full object-contain"
              style={{ maxHeight: coverMaxHeight }}
            />
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto ${cardBodyPadding}`}>
          {/* Encabezado */}
          <div className="mb-6 text-center">
            <div className="relative mb-2 flex items-center justify-center gap-2">
              {paso === 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="absolute left-0 h-8 w-8 text-muted-foreground hover:bg-primary/10"
                  disabled={loading}
                  aria-label="Cambiar usuario"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <h2 className={`${headerTitleClass} font-semibold text-foreground`}>
                {paso === 1 ? 'Iniciar Sesión' : 'Autenticación'}
              </h2>
            </div>
            <p className={`${subheaderTextClass} text-muted-foreground`}>
              {paso === 1
                ? 'Ingresa tus credenciales para continuar'
                : `Verificando acceso para ${usuarioVisible}`}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <div className="flex items-center gap-3 text-destructive">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-destructive/20">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                </div>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {paso === 1 ? (
            <form onSubmit={handleStepOne}>
              <div className={formSpacingClass}>
                <div className="space-y-3">
                  <label htmlFor="sigma-usuario" className="text-sm font-semibold text-foreground">
                    Usuario Corporativo
                  </label>
                  <Input
                    id="sigma-usuario"
                    name="usuario"
                    type="text"
                    placeholder="Ingresa tu usuario"
                    autoFocus
                    autoComplete="username"
                    disabled={loading}
                    value={usuario}
                    onChange={(event) => setUsuario(event.target.value)}
                    className={`${controlSizeClass} rounded-xl border-2 border-border px-4 transition-colors focus:border-primary`}
                  />
                  <div className="rounded-lg border-l-4 border-primary/50 bg-muted/30 p-3">
                    <p className={`${infoTextClass} text-muted-foreground`}>
                      💡 <span className="font-medium">Ejemplo:</span> Usa solo{' '}
                      <span className="font-semibold text-primary">54</span> en lugar de
                      54@grupolefarma.com.mx
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className={`w-full ${buttonSizeClass} rounded-xl bg-primary font-semibold text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Verificando usuario...
                    </>
                  ) : (
                    'Continuar →'
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStepTwo}>
              <div className={formSpacingClass}>
                <div className="space-y-3">
                  <label htmlFor="sigma-dominio" className="text-sm font-semibold text-foreground">
                    Dominio de Red
                  </label>
                  <Select
                    value={dominio || (availableDomains.length === 1 ? availableDomains[0] : '')}
                    onValueChange={setDominio}
                    disabled={loading || !requiresDomainSelection}
                  >
                    <SelectTrigger
                      id="sigma-dominio"
                      className={`w-full ${controlSizeClass} rounded-xl border-2 border-border bg-background px-4 transition-colors hover:bg-accent/50 focus:border-primary`}
                    >
                      <SelectValue placeholder="Selecciona tu dominio" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] rounded-xl border-2 shadow-xl">
                      {availableDomains.map((domain, index) => (
                        <SelectItem
                          key={domain || `dominio-${index}`}
                          value={domain || ''}
                          className="my-1 cursor-pointer rounded-lg px-4 py-3 text-base focus:bg-primary/10 data-[highlighted]:bg-primary/10"
                        >
                          {/* Igual que SIGMA: nombre del usuario y debajo el dominio */}
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-foreground">{nombreDominio}</span>
                            <small className="text-xs font-normal text-muted-foreground/70">
                              {domain}
                            </small>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label htmlFor="sigma-password" className="text-sm font-semibold text-foreground">
                    Contraseña
                  </label>
                  <Input
                    id="sigma-password"
                    name="password"
                    type="password"
                    placeholder="Ingresa tu contraseña"
                    autoFocus
                    autoComplete="current-password"
                    disabled={loading}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${controlSizeClass} rounded-xl border-2 border-border px-4 transition-colors focus:border-primary`}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className={`w-full ${buttonSizeClass} rounded-xl bg-primary font-semibold text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Pie */}
          <div className="mt-8 space-y-4">
            {paso === 1 && (
              <div className="text-center">
                <p className={`${footerTextClass} text-muted-foreground`}>
                  ¿No tienes credenciales?{' '}
                  <Link
                    to="/SIGMA/acceso-externo"
                    className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    Acceso Anónimo
                  </Link>
                </p>
              </div>
            )}

            {paso === 2 && (
              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← Cambiar Usuario
                </Button>
              </div>
            )}

            <div className="border-t border-border/30 pt-4 text-center">
              <p className={`${infoTextClass} text-muted-foreground/80`}>
                🔒 Acceso seguro para empleados de Grupo Lefarma
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
