import { useConfigStore } from '@/store/configStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

const ENVIRONMENT_BADGES = {
  development: { label: 'Desarrollo', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  staging: { label: 'Staging', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  production: { label: 'Producción', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
};

export function SistemaConfig() {
  const { sistema } = useConfigStore();
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const InfoRow = ({ label, value, copyKey }: { label: string; value: string; copyKey?: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="space-y-1">
        <Label className="text-sm font-normal text-muted-foreground">{label}</Label>
        <p className="text-sm font-medium">{value || 'No disponible'}</p>
      </div>
      {copyKey && (
        <button
          onClick={() => handleCopy(value, copyKey)}
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
      {/* Información del Sistema */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Sistema</CardTitle>
          <CardDescription>Datos técnicos y versión de la aplicación</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <InfoRow label="Versión" value={sistema.version} copyKey="version" />
            <InfoRow label="Nombre de la Aplicación" value={sistema.appName} copyKey="appName" />
            <InfoRow label="Entorno" value={envBadge.label} />
            <InfoRow label="API URL" value={sistema.apiUrl} copyKey="apiUrl" />
            {sistema.buildDate && <InfoRow label="Fecha de Build" value={sistema.buildDate} />}
            {sistema.gitCommit && (
              <InfoRow label="Git Commit" value={sistema.gitCommit.substring(0, 7)} copyKey="gitCommit" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Variables de Entorno (Solo Lectura) */}
      <Card>
        <CardHeader>
          <CardTitle>Variables de Entorno</CardTitle>
          <CardDescription>
            Configuración global del sistema (solo lectura, requiere acceso de administrador para modificar)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">VITE_API_URL</Label>
                <span className="text-xs font-mono bg-background px-2 py-1 rounded">{sistema.apiUrl}</span>
              </div>
              <p className="text-xs text-muted-foreground">URL base para las llamadas a la API</p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">VITE_APP_NAME</Label>
                <span className="text-xs font-mono bg-background px-2 py-1 rounded">{sistema.appName}</span>
              </div>
              <p className="text-xs text-muted-foreground">Nombre de la aplicación</p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">VITE_APP_VERSION</Label>
                <span className="text-xs font-mono bg-background px-2 py-1 rounded">{sistema.version}</span>
              </div>
              <p className="text-xs text-muted-foreground">Versión actual de la aplicación</p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">MODE</Label>
                <span className={`text-xs font-mono px-2 py-1 rounded ${envBadge.color}`}>
                  {sistema.environment}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Entorno de ejecución</p>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Nota:</strong> Estas variables se definen en el archivo <code>.env</code> y requieren
              reiniciar la aplicación para cambiar. Contacta al administrador del sistema para modificaciones.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Estado de Conexión */}
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
