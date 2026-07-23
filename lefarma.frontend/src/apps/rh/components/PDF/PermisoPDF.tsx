import type { Props } from './SolicitudPersonalPDF';
import { fmtDate, fmtDateTime } from './pdfFormat';
import { getCategoriaNombre } from '@/types/solicitudPersonal.types';

// ponytail: per-type formatting deferred; plain data dump for now
export function PermisoPDF({ solicitud, historial = [], pasosWorkflow = [] }: Props) {
  const flujoPasos = pasosWorkflow
    .filter((p) => p.activo)
    .sort((a, b) => a.orden - b.orden)
    .map((paso) => {
      const eventos = historial.filter((h) => h.idPaso === paso.idPaso);
      const ultimo = eventos.length > 0 ? eventos[eventos.length - 1] : null;
      return ultimo
        ? {
            idPaso: paso.idPaso,
            nombrePaso: paso.nombrePaso,
            participante: ultimo.nombreUsuario ?? `Usuario ${ultimo.idUsuario}`,
            accion: ultimo.nombreAccion ?? '',
            fecha: ultimo.fechaEvento ?? null,
          }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div id="solicitud-personal-pdf-print">
      <div><strong>Folio:</strong> {solicitud.folio ?? '-'}</div>
      <div><strong>Fecha:</strong> {fmtDate(solicitud.fechaCreacion)}</div>
      <div><strong>Empresa:</strong> {solicitud.empresaNombre ?? `ID ${solicitud.idEmpresa}`}</div>
      <div><strong>Sucursal:</strong> {solicitud.sucursalNombre ?? `ID ${solicitud.idSucursal}`}</div>
      <div><strong>Área:</strong> {solicitud.areaNombre ?? `ID ${solicitud.idArea}`}</div>
      <div><strong>Nombre del solicitante:</strong> {solicitud.solicitanteNombre ?? '-'}</div>
      <div><strong>Puesto:</strong> {solicitud.solicitantePuesto ?? '-'}</div>
      <div><strong>Estado:</strong> {solicitud.estadoNombre ?? '-'}</div>
      <div><strong>Categoría:</strong> {getCategoriaNombre(solicitud.categoria)}</div>
      <div>
        <strong>Tipo de solicitud:</strong>{' '}
        {solicitud.tipoSolicitudNombre ?? `Tipo #${solicitud.idTipoSolicitud}`}
      </div>
      <div><strong>Fecha de inicio:</strong> {fmtDate(solicitud.fechaInicio)}</div>
      <div><strong>Fecha de fin:</strong> {fmtDate(solicitud.fechaFin)}</div>
      <div><strong>Días solicitados:</strong> {solicitud.diasSolicitados ?? '-'}</div>
      {solicitud.fechaRegreso && (
        <div><strong>Fecha de regreso:</strong> {fmtDate(solicitud.fechaRegreso)}</div>
      )}
      {solicitud.fechaRegreso && (
        <div><strong>Fecha de reposición:</strong> {fmtDate(solicitud.fechaReposicion)}</div>
      )}
      {solicitud.fechaEnvio && (
        <div><strong>Fecha de envío:</strong> {fmtDate(solicitud.fechaEnvio)}</div>
      )}
      {solicitud.fechaEnvio && (
        <div>
          <strong>Paso actual:</strong>{' '}
          {solicitud.pasoActual ?? `Paso #${solicitud.idPasoActual ?? ''}`}
        </div>
      )}
      {solicitud.lugarComision && (
        <div><strong>Lugar de comisión:</strong> {solicitud.lugarComision}</div>
      )}
      {solicitud.motivo && (
        <div><strong>Motivo:</strong> {solicitud.motivo}</div>
      )}
      {solicitud.detalle && solicitud.detalle.length > 0 && (
        <>
          <div><strong>Detalle de días:</strong></div>
          {solicitud.detalle.map((d, idx) => (
            <div key={idx}>
              {idx + 1}. {fmtDate(d.fecha)}
            </div>
          ))}
        </>
      )}
      {flujoPasos.length > 0 && (
        <>
          <div><strong>Flujo de autorización:</strong></div>
          {flujoPasos.map((paso, idx) => (
            <div key={paso.idPaso}>
              {idx + 1}. {paso.nombrePaso} — {paso.participante} — {paso.accion || '—'} —{' '}
              {paso.fecha ? fmtDateTime(paso.fecha) : '—'}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
