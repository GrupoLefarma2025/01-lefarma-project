import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';

interface SolicitudHeaderCardProps {
  solicitud: SolicitudPersonalResponse;
  getEstadoInfo: (solicitud: Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'> | null | undefined) => { nombre: string; color: string };
}

export function SolicitudHeaderCard({ solicitud, getEstadoInfo }: SolicitudHeaderCardProps) {
  const info = getEstadoInfo(solicitud);

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold">{solicitud.folio}</span>
            {solicitud.pasoActual && (
              <span className="text-xs text-muted-foreground">
                Paso actual: <span className="font-medium text-foreground">{solicitud.pasoActual}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {solicitud.tipoSolicitudNombre || `Tipo #${solicitud.idTipoSolicitud}`}
          </p>
        </div>
        <span
          className="inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
          style={{
            borderColor: info.color,
            color: info.color,
            backgroundColor: info.color + '15',
          }}
        >
          {info.nombre}
        </span>
      </div>
    </div>
  );
}
