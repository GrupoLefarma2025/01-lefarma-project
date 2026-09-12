import { AlertTriangle, ArrowRight, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface RutasAlertsProps {
  // Acción requerida: problemas que no se resuelven en esta pantalla.
  sinAsignacion: { cantidad: number; nombres: string[] };
  onIrASeleccion: () => void;
  // Advertencias derivadas en cliente (p. ej. foráneos excedidos por equipo).
  advertencias: string[];
  // Avisos del backend al generar (se conservan para no perder información).
  avisosBackend: string[];
  // Nota informativa (versión archivada/confirmada de solo lectura).
  info: string | null;
}

const ES_ACCION = (aviso: string) =>
  /sin ruta|región|region|Reparto|equipo asignado/i.test(aviso);
const ES_ADVERTENCIA = (aviso: string) =>
  /viajes foráneos|foráneos|sin clasificar|superan/i.test(aviso);

export function RutasAlerts({
  sinAsignacion,
  onIrASeleccion,
  advertencias,
  avisosBackend,
  info,
}: RutasAlertsProps) {
  const avisosAccion = avisosBackend.filter(ES_ACCION);
  const avisosAdvertencia = avisosBackend.filter((a) => !ES_ACCION(a) && ES_ADVERTENCIA(a));
  const avisosInfo = avisosBackend.filter((a) => !ES_ACCION(a) && !ES_ADVERTENCIA(a));

  const hayAccion = sinAsignacion.cantidad > 0 || avisosAccion.length > 0;
  const todasAdvertencias = [
    ...advertencias,
    ...avisosAdvertencia,
    ...(hayAccion ? [] : avisosAccion),
  ];

  if (!hayAccion && todasAdvertencias.length === 0 && avisosInfo.length === 0 && !info) {
    return null;
  }

  return (
    <div className="space-y-2">
      {hayAccion && (
        <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">
            {sinAsignacion.cantidad > 0
              ? `${sinAsignacion.cantidad} hospital${sinAsignacion.cantidad === 1 ? '' : 'es'} requiere${sinAsignacion.cantidad === 1 ? '' : 'n'} atención`
              : 'Hospitales requieren atención'}
          </AlertTitle>
          <AlertDescription className="space-y-2 text-amber-800">
            {sinAsignacion.cantidad > 0 && (
              <p>
                No tienen región o equipo asignado y no pueden planificarse correctamente
                {sinAsignacion.nombres.length > 0 && (
                  <span className="text-amber-700">
                    {' '}
                    ({sinAsignacion.nombres.slice(0, 5).join(', ')}
                    {sinAsignacion.nombres.length > 5 ? ', …' : ''})
                  </span>
                )}
                .
              </p>
            )}
            {avisosAccion.map((aviso) => (
              <p key={aviso}>{aviso}</p>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-1 border-amber-400 text-amber-900 hover:bg-amber-100"
              onClick={onIrASeleccion}
            >
              Ir a Selección y reparto
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {todasAdvertencias.map((aviso) => (
        <Alert key={aviso} className="border-amber-200 bg-amber-50/60">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">{aviso}</AlertDescription>
        </Alert>
      ))}

      {info && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      )}

      {avisosInfo.map((aviso) => (
        <Alert key={aviso}>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-muted-foreground">{aviso}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
