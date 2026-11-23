import { Activity } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TelemetriaPanel } from './TelemetriaPanel';

/**
 * Página de observabilidad en `/configuracion/telemetria` (dentro del layout de
 * Configuración). El contenido vive en `TelemetriaPanel`.
 */
export function TelemetriaPage() {
  usePageTitle('Telemetría', 'Errores, clics y mapa de calor de la aplicación');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-[#eb6c36]" />
        <div>
          <h1 className="text-lg font-semibold">Telemetría</h1>
          <p className="text-xs text-muted-foreground">
            Errores, clics y mapa de calor de la aplicación
          </p>
        </div>
      </div>

      <TelemetriaPanel />
    </div>
  );
}
