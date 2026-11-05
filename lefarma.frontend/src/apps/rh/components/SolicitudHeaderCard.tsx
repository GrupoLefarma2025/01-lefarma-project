import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';

interface SolicitudHeaderCardProps {
  solicitud: SolicitudPersonalResponse;
  getEstadoInfo: (
    solicitud:
      | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
      | null
      | undefined
  ) => { nombre: string; color: string };
  /** Versión de una sola línea, para modales densos (p. ej. historial con zoom alto). */
  compact?: boolean;
}

function EstadoBadge({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{
        borderColor: color,
        color,
        backgroundColor: color + '15',
      }}
    >
      {nombre}
    </span>
  );
}

export function SolicitudHeaderCard({
  solicitud,
  getEstadoInfo,
  compact = false,
}: SolicitudHeaderCardProps) {
  const info = getEstadoInfo(solicitud);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/20 px-3 py-1.5">
        <span className="text-sm font-semibold">{solicitud.folio}</span>
        {solicitud.pasoActual && (
          <span className="text-xs text-muted-foreground">
            Paso actual:{' '}
            <span className="font-medium text-foreground">{solicitud.pasoActual}</span>
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {solicitud.tipoSolicitudNombre || '—'}
          {solicitud.solicitanteNombre && (
            <span className="ml-2">· Solicitante: {solicitud.solicitanteNombre}</span>
          )}
        </span>
        <span className="ml-auto">
          <EstadoBadge nombre={info.nombre} color={info.color} />
        </span>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold">{solicitud.folio}</span>
            {solicitud.pasoActual && (
              <span className="text-xs text-muted-foreground">
                Paso actual:{' '}
                <span className="font-medium text-foreground">{solicitud.pasoActual}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {solicitud.tipoSolicitudNombre || '—'}
            {solicitud.solicitanteNombre && (
              <span className="ml-2">· Solicitante: {solicitud.solicitanteNombre}</span>
            )}
          </p>
        </div>
        <EstadoBadge nombre={info.nombre} color={info.color} />
      </div>
    </div>
  );
}
