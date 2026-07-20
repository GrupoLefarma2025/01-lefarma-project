import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import { getCategoriaNombre } from '@/types/solicitudPersonal.types';

const fmtFecha = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

interface SolicitudDetalleTabProps {
  solicitud: SolicitudPersonalResponse;
}

export function SolicitudDetalleTab({ solicitud }: SolicitudDetalleTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Categoría</p>
          <p className="font-medium">{getCategoriaNombre(solicitud.categoria)}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Tipo de solicitud</p>
          <p className="font-medium">
            {solicitud.tipoSolicitudNombre || `Tipo #${solicitud.idTipoSolicitud}`}
          </p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Empresa</p>
          <p className="font-medium">{solicitud.empresaNombre || `ID ${solicitud.idEmpresa}`}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Sucursal</p>
          <p className="font-medium">{solicitud.sucursalNombre || `ID ${solicitud.idSucursal}`}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Área</p>
          <p className="font-medium">{solicitud.areaNombre || 'Sin área'}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Solicitante</p>
          <p className="font-medium">
            {solicitud.solicitanteNombre || `ID ${solicitud.idUsuarioCreador}`}
          </p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Fecha de solicitud</p>
          <p className="font-medium">{fmtFecha(solicitud.fechaCreacion)}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Fecha de envío</p>
          <p className="font-medium">{fmtFecha(solicitud.fechaEnvio)}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Fecha inicio</p>
          <p className="font-medium">{fmtFecha(solicitud.fechaInicio)}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-1.5">
          <p className="text-muted-foreground">Fecha fin</p>
          <p className="font-medium">{fmtFecha(solicitud.fechaFin)}</p>
        </div>
        {solicitud.diasSolicitados != null && (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-muted-foreground">Días solicitados</p>
            <p className="font-medium">{solicitud.diasSolicitados}</p>
          </div>
        )}
        {solicitud.fechaRegreso && (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-muted-foreground">Fecha de regreso</p>
            <p className="font-medium">{fmtFecha(solicitud.fechaRegreso)}</p>
          </div>
        )}
        {solicitud.fechaReposicion && (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-muted-foreground">Fecha de reposición</p>
            <p className="font-medium">{fmtFecha(solicitud.fechaReposicion)}</p>
          </div>
        )}
      </div>

      {solicitud.motivo && (
        <div className="rounded-md border bg-background px-3 py-2 text-xs">
          <p className="text-muted-foreground">Motivo</p>
          <p className="mt-1 whitespace-pre-wrap">{solicitud.motivo}</p>
        </div>
      )}

      {solicitud.lugarComision && (
        <div className="rounded-md border bg-background px-3 py-2 text-xs">
          <p className="text-muted-foreground">Lugar de comisión</p>
          <p className="mt-1">{solicitud.lugarComision}</p>
        </div>
      )}

      {solicitud.detalle && solicitud.detalle.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-3 py-2">
            <p className="text-sm font-medium">Detalle de días</p>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {solicitud.detalle.map((d, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{fmtFecha(d.fecha)}</td>
                    <td className="px-3 py-2">{d.comentario || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
