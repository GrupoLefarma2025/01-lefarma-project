import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, User, AlertCircle, ArrowLeft, CheckCircle, Building2, Building, MapPin } from 'lucide-react';
import logoEstatico from '@/assets/logo.png';


const DOMAIN_NAMES: Record<string, string> = {
  'LEFARMA-HN': 'LeFarma Honduras',
  'LEFARMA-GT': 'LeFarma Guatemala',
  'LEFARMA-SV': 'LeFarma El Salvador',
  'LEFARMA-NI': 'LeFarma Nicaragua',
  'LEFARMA-CR': 'LeFarma Costa Rica',
  'DC': 'Distribuidora Central',
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
    loginStepOne,
    loginStepTwo,
    loginStepThree,
    resetLoginFlow,
  } = useAuthStore();

  const [username, setUsername] = useState(pendingUsername || '');
  const [password, setPassword] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [error, setError] = useState('');

  const sucursalesFiltradas = sucursales.filter((s) => {
    if (!s.idSucursal || s.idSucursal === undefined) return false;
    if (!s.idEmpresa || s.idEmpresa === undefined) return false;
    return String(s.idEmpresa) === String(selectedEmpresa);
  });

  const areasFiltradas = areas.filter((a) => {
    if (!a.idArea) return false;
    return String(a.idEmpresa) === String(selectedEmpresa);
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!requiresDomainSelection && availableDomains.length === 1) {
      setSelectedDomain(availableDomains[0]);
    }
  }, [requiresDomainSelection, availableDomains]);

  useEffect(() => {
    if (pendingUsername) {
      setUsername(pendingUsername);
    }
  }, [pendingUsername]);

  useEffect(() => {
    if (loginStep === 3) {
      const empresasValidas = empresas.filter((e) => e.idEmpresa && e.idEmpresa !== undefined);
      if (empresasValidas.length === 1) {
        setSelectedEmpresa(String(empresasValidas[0].idEmpresa));
      }
    }
  }, [loginStep, empresas]);

  useEffect(() => {
    if (selectedEmpresa && sucursalesFiltradas.length === 1) {
      const sucursal = sucursalesFiltradas[0];
      if (sucursal.idSucursal && sucursal.idSucursal !== undefined) {
        setSelectedSucursal(String(sucursal.idSucursal));
      }
    } else if (!selectedEmpresa) {
      setSelectedSucursal('');
    }
  }, [selectedEmpresa, sucursalesFiltradas]);

  useEffect(() => {
    if (selectedEmpresa && areasFiltradas.length === 1) {
      setSelectedArea(String(areasFiltradas[0].idArea));
    } else if (!selectedEmpresa) {
      setSelectedArea('');
    }
  }, [selectedEmpresa, areasFiltradas]);

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
      const message =
        err instanceof Error ? err.message : 'Usuario no encontrado';
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

    const domain = requiresDomainSelection
      ? selectedDomain
      : availableDomains[0];

    try {
      await loginStepTwo(password, domain);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Credenciales incorrectas';
      setError(message);
    }
  };

  const handleStepThree = async (e: FormEvent) => {
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

    if (areasFiltradas.length > 0 && !selectedArea) {
      setError('Por favor selecciona un área');
      return;
    }

    try {
      await loginStepThree(selectedEmpresa, selectedSucursal, selectedArea);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al seleccionar ubicación';
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
          <div className="flex items-center justify-center gap-2 my-4">
            <div
              className={`flex items-center gap-2 ${
                loginStep >= 1 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  loginStep >= 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {loginStep > 1 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  '1'
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline">
                Usuario
              </span>
            </div>

            <div
              className={`h-0.5 w-6 ${
                loginStep > 1 ? 'bg-primary' : 'bg-muted'
              }`}
            />

            <div
              className={`flex items-center gap-2 ${
                loginStep >= 2 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  loginStep >= 2
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {loginStep > 2 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  '2'
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline">
                Contraseña
              </span>
            </div>

            <div
              className={`h-0.5 w-6 ${
                loginStep > 2 ? 'bg-primary' : 'bg-muted'
              }`}
            />

            <div
              className={`flex items-center gap-2 ${
                loginStep >= 3 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  loginStep >= 3
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                3
              </div>
              <span className="text-sm font-medium hidden sm:inline">
                Ubicación
              </span>
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
                <label className="text-sm font-medium">
                  Nombre de Usuario
                </label>
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

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
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
                <div className="text-center py-2 px-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Hola,</p>
                  <p className="font-medium">{displayName}</p>
                </div>
              )}

              {requiresDomainSelection && availableDomains.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Seleccionar Dominio
                  </label>
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
                        <SelectItem
                          key={domain || `domain-${index}`}
                          value={domain || ''}
                        >
                          {DOMAIN_NAMES[domain] || domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!requiresDomainSelection && availableDomains.length === 1 && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg text-primary">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">
                    Dominio:{' '}
                    {DOMAIN_NAMES[availableDomains[0]] || availableDomains[0]}
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

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Verificando...' : 'Continuar'}
              </Button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" />
                Usar otro usuario
              </button>
            </form>
          )}

          {/* PASO 3: Empresa, Sucursal y Área */}
          {loginStep === 3 && (
            <form onSubmit={handleStepThree} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {displayName && (
                <div className="text-center py-2 px-4 bg-primary/10 rounded-lg text-primary">
                  <p className="text-sm font-medium">
                    Bienvenido, {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Selecciona la ubicación desde la cual generarás órdenes de compra
                  </p>
                </div>
              )}

              {/* Empresa */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </label>
                <Select
                  value={selectedEmpresa}
                  onValueChange={(val) => {
                    setSelectedEmpresa(val);
                    setSelectedSucursal('');
                    setSelectedArea('');
                  }}
                  disabled={isLoading}
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
              {selectedEmpresa && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Sucursal
                    {empresaSeleccionada && (
                      <span className="text-muted-foreground font-normal">
                        - {empresaSeleccionada.nombre}
                      </span>
                    )}
                  </label>
                  <Select
                    value={selectedSucursal}
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
              {selectedEmpresa && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Área
                  </label>
                  {areasFiltradas.length > 0 ? (
                    <Select
                      value={selectedArea}
                      onValueChange={setSelectedArea}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un área" />
                      </SelectTrigger>
                      <SelectContent>
                        {areasFiltradas.map((area) => (
                          <SelectItem
                            key={area.idArea}
                            value={String(area.idArea)}
                          >
                            {area.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No hay áreas disponibles para esta empresa.
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  !selectedEmpresa ||
                  !selectedSucursal ||
                  (areasFiltradas.length > 0 && !selectedArea) ||
                  isLoading
                }
              >
                {isLoading ? 'Procesando...' : 'Iniciar Sesión'}
              </Button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
