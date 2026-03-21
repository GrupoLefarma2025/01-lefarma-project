import { useConfigStore } from '@/store/configStore';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Copy, Check, Lock, Clock, HardDrive, Globe, Shield, DollarSign, FileCode, Server, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { systemConfigService, BackendConfigResponse } from '@/services/systemConfigService';

const ENVIRONMENT_BADGES = {
  development: { label: 'Desarrollo', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  staging: { label: 'Staging', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  production: { label: 'Producción', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
};

export function SistemaConfig() {
  const { sistema, globalConfig } = useConfigStore();
  const { user } = useAuthStore();
  const [copied, setCopied] = useState<string | null>(null);
  const [backendConfig, setBackendConfig] = useState<BackendConfigResponse | null>(null);
  const [loadingBackendConfig, setLoadingBackendConfig] = useState(true);
  const isAdmin = user?.roles?.some(r => r.nombreRol === 'Administrador') || false;

  useEffect(() => {
    const fetchBackendConfig = async () => {
      try {
        const config = await systemConfigService.getBackendConfig();
        setBackendConfig(config);
      } catch (error) {
        console.error('Error al cargar configuración del backend:', error);
      } finally {
        setLoadingBackendConfig(false);
      }
    };

    fetchBackendConfig();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const InfoRow = ({ label, value, copyKey, icon: Icon }: { label: string; value: string | number; copyKey?: string; icon?: React.ElementType }) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <div className="space-y-1">
          <Label className="text-sm font-normal text-muted-foreground">{label}</Label>
          <p className="text-sm font-medium">{value ?? 'No disponible'}</p>
        </div>
      </div>
      {copyKey && (
        <button
          onClick={() => handleCopy(String(value), copyKey)}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          title="Copiar"
        >
          {copied === copyKey ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  );

  const envBadge = ENVIRONMENT_BADGES[sistema.environment];

  return (
    <div className="space-y-6">
      {/* Información del Sistema (info técnica del build) */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Sistema</CardTitle>
          <CardDescription>Datos técnicos de la aplicación (información del build)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <InfoRow label="Versión" value={sistema.version} copyKey="version" />
            <InfoRow label="Nombre" value={sistema.appName} copyKey="appName" />
            <InfoRow label="Entorno" value={envBadge.label} />
            <InfoRow label="API URL" value={sistema.apiUrl} copyKey="apiUrl" />
            {sistema.buildDate && <InfoRow label="Fecha de Build" value={sistema.buildDate} />}
            {sistema.gitCommit && (
              <InfoRow label="Git Commit" value={sistema.gitCommit.substring(0, 7)} copyKey="gitCommit" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Variables de Entorno Frontend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Variables de Entorno (Frontend)
          </CardTitle>
          <CardDescription>
            Variables definidas en el archivo .env - Se leen al iniciar la aplicación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <InfoRow label="VITE_API_URL" value={sistema.apiUrl} copyKey="apiUrl" />
            <InfoRow label="VITE_APP_NAME" value={sistema.appName} copyKey="appName" />
            <InfoRow label="VITE_APP_VERSION" value={sistema.version} copyKey="version" />
            <InfoRow label="MODE" value={sistema.environment} />
          </div>

          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>⚠️ Solo lectura:</strong> Estas variables se leen del archivo <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40">.env</code> al iniciar la aplicación.
              Para modificarlas, edita el archivo <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40">.env</code> y reinicia el servidor de desarrollo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Variables de Entorno Backend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Variables de Entorno (Backend)
          </CardTitle>
          <CardDescription>
            Variables definidas en appsettings.json - Solo datos no sensibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBackendConfig ? (
            <p className="text-sm text-muted-foreground">Cargando configuración del backend...</p>
          ) : backendConfig ? (
            <div className="space-y-6">
              {/* JWT Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Shield className="h-4 w-4" />
                  Configuración JWT
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">Expiración (minutos)</p>
                    <p className="text-sm font-medium">{backendConfig.jwt.expirationMinutes}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">Issuer</p>
                    <p className="text-sm font-medium">{backendConfig.jwt.issuer}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">Audience</p>
                    <p className="text-sm font-medium">{backendConfig.jwt.audience}</p>
                  </div>
                </div>
              </div>

              {/* Email Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Globe className="h-4 w-4" />
                  Configuración Email (SMTP)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">Servidor SMTP</p>
                    <p className="text-sm font-medium">{backendConfig.email.smtpServer}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">Puerto</p>
                    <p className="text-sm font-medium">{backendConfig.email.smtpPort}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">SSL/TLS</p>
                    <p className="text-sm font-medium">{backendConfig.email.enableSSL ? 'Habilitado' : 'Deshabilitado'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">From Email</p>
                    <p className="text-sm font-medium">{backendConfig.email.fromEmail}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">From Name</p>
                    <p className="text-sm font-medium">{backendConfig.email.fromName}</p>
                  </div>
                </div>
              </div>

              {/* Telegram Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Send className="h-4 w-4" />
                  Configuración Telegram
                </div>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4 pl-6">
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">API URL</p>
                    <p className="text-sm font-mono">{backendConfig.telegram.apiUrl}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-600">Error al cargar configuración del backend</p>
          )}

          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>⚠️ Solo lectura:</strong> Estas variables se leen del archivo <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40">appsettings.json</code>.
              Se muestran únicamente variables no sensibles (sin passwords, tokens ni secrets).
              Para modificarlas, edita el archivo de configuración y reinicia el backend.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuración Global (variables configurables en runtime) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Configuración Global
              </CardTitle>
              <CardDescription>
                Variables que afectan a toda la aplicación en runtime
              </CardDescription>
            </div>
            {!isAdmin && (
              <div className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-xs font-medium">
                Solo lectura
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuración de Sesión */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4" />
              Configuración de Sesión
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Timeout de Sesión</p>
                <p className="text-sm font-medium">{globalConfig.sessionTimeout} minutos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Alerta de Timeout</p>
                <p className="text-sm font-medium">{globalConfig.sessionWarning} minutos antes</p>
              </div>
            </div>
          </div>

          {/* Configuración de Archivos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <HardDrive className="h-4 w-4" />
              Configuración de Archivos
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Tamaño Máximo</p>
                <p className="text-sm font-medium">{globalConfig.maxFileSize} MB</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Formatos Permitidos</p>
                <p className="text-sm font-medium">{globalConfig.allowedFileTypes.length} tipos</p>
              </div>
            </div>
            <div className="pl-6">
              <p className="text-xs text-muted-foreground font-mono">
                {globalConfig.allowedFileTypes.join(', ')}
              </p>
            </div>
          </div>

          {/* Configuración de UI Global */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe className="h-4 w-4" />
              Configuración de UI Global
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Moneda por Defecto</p>
                <p className="text-sm font-medium">{globalConfig.defaultCurrency}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Formato de Fecha</p>
                <p className="text-sm font-medium">{globalConfig.defaultDateFormat}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Formato de Hora</p>
                <p className="text-sm font-medium">{globalConfig.defaultTimeFormat}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Items por Página</p>
                <p className="text-sm font-medium">{globalConfig.defaultPageSize}</p>
              </div>
            </div>
          </div>

          {/* Configuración de Negocio */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <DollarSign className="h-4 w-4" />
              Configuración de Negocio
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Tipo de Cambio (LPS/USD)</p>
                <p className="text-sm font-medium">L{globalConfig.tipoCambioDefecto.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Impuesto (ISV/IVA)</p>
                <p className="text-sm font-medium">{globalConfig.impuestoPorDefecto}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Notificaciones Globales</p>
                <p className="text-sm font-medium">{globalConfig.notificacionesEnabled ? 'Habilitadas' : 'Deshabilitadas'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Schedule de Job</p>
                <p className="text-sm font-medium font-mono">{globalConfig.notificacionesJobSchedule}</p>
              </div>
            </div>
          </div>

          {/* Configuración de Seguridad */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Shield className="h-4 w-4" />
              Configuración de Seguridad
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Longitud Mínima de Contraseña</p>
                <p className="text-sm font-medium">{globalConfig.passwordMinLength} caracteres</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Intentos Máximos de Login</p>
                <p className="text-sm font-medium">{globalConfig.maxLoginAttempts} intentos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Bloqueo por</p>
                <p className="text-sm font-medium">{globalConfig.lockoutDuration} minutos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Requisitos de Contraseña</p>
                <p className="text-xs text-muted-foreground">
                  {globalConfig.passwordRequireUppercase && 'Mayúsculas ✓ '}
                  {globalConfig.passwordRequireLowercase && 'Minúsculas ✓ '}
                  {globalConfig.passwordRequireNumbers && 'Números ✓ '}
                  {globalConfig.passwordRequireSpecialChars && 'Especiales ✓'}
                </p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Última actualización: {new Date(globalConfig.metadata.updatedAt).toLocaleString('es-HN')}</span>
              <span>Por: {globalConfig.metadata.updatedBy}</span>
            </div>
          </div>

          {!isAdmin && (
            <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Nota:</strong> Estas variables de configuración global son de solo lectura para usuarios estándar.
                Solo los administradores pueden modificar estos valores, los cuales afectan a toda la aplicación en tiempo de ejecución.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estado de Servicios */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Servicios</CardTitle>
          <CardDescription>Estado actual de los servicios del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Frontend</p>
                <p className="text-xs text-muted-foreground">Aplicación web</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-600 dark:text-green-400">Activo</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Backend API</p>
                <p className="text-xs text-muted-foreground">{sistema.apiUrl}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-600 dark:text-green-400">Conectado</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
