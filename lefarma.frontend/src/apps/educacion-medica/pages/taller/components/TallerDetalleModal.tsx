import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileSignature,
  History,
  MapPin,
  Package,
  PlayCircle,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  Taller,
  TallerEstadoHistorial,
  TallerRecurso,
} from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtFecha = (fecha: string | null | undefined) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

const ETIQUETAS_RECURSO: Record<string, string> = {
  Producto: 'Muestra de producto',
  Folleto: 'Folletos',
  Envio: 'Gastos de envío',
  BoxLunch: 'Box lunch',
};

const detalleRecurso = (recurso: TallerRecurso) => {
  const partes = [
    recurso.tipoRecurso === 'Producto' ? (recurso.nombreProducto ?? recurso.idProducto) : null,
    recurso.tipoRecurso === 'Envio' ? recurso.tipoEnvio : null,
    recurso.descripcion,
    recurso.observaciones,
  ].filter((p): p is string => !!p);
  return partes.join(' · ') || '—';
};

/** Estilo del panel de estado de la cabecera (color + icono por estado). */
function estadoVisual(estado: string) {
  switch (estado) {
    case 'EnCurso':
      return {
        Icono: PlayCircle,
        label: 'En curso',
        clase: 'border-sky-300 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/40',
        iconoClase: 'text-sky-600 dark:text-sky-400',
      };
    case 'Realizado':
      return {
        Icono: CheckCircle2,
        label: 'Realizado',
        clase: 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30',
        iconoClase: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'Cancelado':
      return {
        Icono: XCircle,
        label: 'Cancelado',
        clase: 'border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30',
        iconoClase: 'text-destructive',
      };
    case 'Programado':
      return {
        Icono: CalendarClock,
        label: 'Programado',
        clase: 'border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30',
        iconoClase: 'text-blue-600 dark:text-blue-400',
      };
    default:
      return {
        Icono: CalendarClock,
        label: estado,
        clase: 'border-border bg-muted/40',
        iconoClase: 'text-muted-foreground',
      };
  }
}

/** "Cuánto falta / hace cuánto" respecto a la fecha del taller. */
function textoRelativo(taller: Taller): string {
  if (taller.estado === 'Realizado') {
    const fecha = taller.fechaRealizado ?? taller.fechaTaller;
    return fecha ? `Realizado el ${fmtFecha(fecha)}` : 'Taller realizado';
  }
  if (taller.estado === 'Cancelado') return 'Taller cancelado';
  if (taller.estado === 'EnCurso') return 'En curso ahora';
  if (!taller.fechaTaller) return 'Sin fecha programada';

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(`${taller.fechaTaller.slice(0, 10)}T00:00:00`);
  const dias = Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000);

  if (dias === 0) return 'Es hoy';
  if (dias === 1) return 'Falta 1 día';
  if (dias > 1) return `Faltan ${dias} días`;
  const abs = Math.abs(dias);
  return abs === 1 ? 'Venció hace 1 día' : `Venció hace ${abs} días`;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="text-sm font-medium">{valor}</p>
    </div>
  );
}

/**
 * Datos de ubicación del hospital para el detalle: la asignación del equipo
 * (Mis talleres) o el catálogo de hospitales (Matriz general). Todos opcionales;
 * lo que falte cae a los datos del propio taller.
 */
export interface UbicacionDetalle {
  nombreRuta?: string | null;
  orden?: number | null;
  institucion?: string | null;
  nombreRegion?: string | null;
  entidadFederativa?: string | null;
  ciudadMunicipio?: string | null;
  calle?: string | null;
  colonia?: string | null;
  codigoPostal?: string | null;
  email?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

interface TallerDetalleModalProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
  /** Ubicación/datos extra del hospital (ruta planeada o catálogo). */
  ubicacion?: UbicacionDetalle | null;
  /** Botones de acción del taller (los arma la página según permisos/estado). */
  acciones?: ReactNode;
}

/** Detalle del taller capturado: estado, logística, recursos y datos del hospital con ubicación. */
export function TallerDetalleModal({
  open,
  onClose,
  taller,
  ubicacion,
  acciones,
}: TallerDetalleModalProps) {
  const [historial, setHistorial] = useState<TallerEstadoHistorial[]>([]);

  useEffect(() => {
    if (!open || taller == null) return;
    let cancelado = false;
    educacionMedicaApi.talleres
      .estados(taller.idTaller)
      .then((res) => {
        if (!cancelado && res.data.success) setHistorial(res.data.data ?? []);
      })
      .catch(() => setHistorial([]));
    return () => {
      cancelado = true;
    };
  }, [open, taller]);

  const lat = ubicacion?.latitud ?? null;
  const lon = ubicacion?.longitud ?? null;
  const direccion =
    [
      ubicacion?.calle,
      ubicacion?.colonia,
      ubicacion?.codigoPostal ? `CP ${ubicacion.codigoPostal}` : null,
    ]
      .filter(Boolean)
      .join(', ') || '—';

  const capturadoPorOtro =
    taller?.capturadoPor != null &&
    taller.idUsuarioCreacion !== taller.idEjecutivo &&
    taller.idUsuarioCreacion !== taller.idEspecialista;

  const visual = estadoVisual(taller?.estado ?? '');
  const { Icono } = visual;

  return (
    <Modal
      id="modal-taller-detalle"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title="Detalle del taller"
      size="wide"
      footer={
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      {taller && (
        <div className="space-y-5">
          {/* Encabezado: hospital, trazabilidad como subtítulo, equipo de pareo y estado */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-semibold">{taller.nombreHospital ?? 'Hospital'}</p>
                <p className="text-xs text-muted-foreground">
                  {capturadoPorOtro && (
                    <>
                      Capturado por{' '}
                      <span className="font-medium text-foreground">{taller.capturadoPor}</span>
                      {' · '}
                    </>
                  )}
                  {[taller.region, taller.entidadFederativa].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {taller.esExtraordinario && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                  >
                    Extraordinario
                  </Badge>
                )}
                {taller.solicitudCambioPendiente && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300"
                  >
                    <FileSignature className="h-3 w-3" />
                    Solicitud pendiente
                  </Badge>
                )}
              </div>
            </div>

            {(taller.nombreEjecutivo || taller.nombreEspecialista) && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Equipo de pareo
                </span>
                <span>
                  <span className="font-medium text-foreground">
                    {taller.nombreEjecutivo ?? '—'}
                  </span>{' '}
                  (EV)
                </span>
                <span>
                  <span className="font-medium text-foreground">
                    {taller.nombreEspecialista ?? '—'}
                  </span>{' '}
                  (EP)
                </span>
              </p>
            )}
          </div>

          {/* Panel de estado + logística (fusión de la antigua sección Logística) */}
          <div className={`rounded-lg border px-4 py-3 ${visual.clase}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <Icono className={`h-4 w-4 ${visual.iconoClase}`} />
                {visual.label}
              </span>
              <span className="text-xs font-medium">{textoRelativo(taller)}</span>
            </div>
            <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              <Dato etiqueta="Fecha del taller" valor={fmtFecha(taller.fechaTaller)} />
              <Dato etiqueta="Hora" valor={taller.horaTaller?.slice(0, 5) ?? '—'} />
              <Dato etiqueta="No. de participantes" valor={taller.numeroParticipantes ?? '—'} />
              <Dato etiqueta="Lugar" valor={taller.lugar ?? '—'} />
              <Dato etiqueta="Unidad médica" valor={taller.unidadMedica ?? '—'} />
              <Dato
                etiqueta="Equipo de proyección"
                valor={
                  taller.requiereEquipoProyeccion == null
                    ? '—'
                    : taller.requiereEquipoProyeccion
                      ? `Sí${taller.tipoEquipoProyeccion ? ` (${taller.tipoEquipoProyeccion})` : ''}`
                      : 'No'
                }
              />
            </div>
          </div>

          {/* Acciones del taller */}
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}

          {/* Origen y trazabilidad (solo si aplica; "Capturado por" vive en el subtítulo) */}
          {(taller.esExtraordinario || taller.solicitudCambioPendiente) && (
            <section className="space-y-2 rounded-lg border border-purple-200 bg-purple-50/40 p-3 dark:border-purple-900 dark:bg-purple-950/20">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                <Sparkles className="h-3.5 w-3.5" />
                Origen y trazabilidad
              </h3>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {taller.esExtraordinario && (
                  <Dato
                    etiqueta="Motivo del extraordinario"
                    valor={taller.motivoExtraordinario ?? '—'}
                  />
                )}
                {taller.solicitudCambioPendiente && (
                  <Dato
                    etiqueta="Solicitud de cambio pendiente"
                    valor={`${taller.solicitudCambioPendiente.nombreSolicitante ?? 'Equipo'} · ${new Date(
                      taller.solicitudCambioPendiente.fecha
                    ).toLocaleString('es-MX')}`}
                  />
                )}
              </div>
            </section>
          )}

          {/* Recursos del taller */}
          <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900 dark:bg-amber-950/20">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <Package className="h-3.5 w-3.5" />
              Recursos del taller
            </h3>
            {taller.recursos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin recursos capturados.</p>
            ) : (
              <div className="divide-y divide-amber-200/70 dark:divide-amber-900/50">
                {taller.recursos.map((recurso) => (
                  <div
                    key={recurso.idTallerRecurso}
                    className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start gap-2">
                      <Package className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-sm font-medium">
                          {ETIQUETAS_RECURSO[recurso.tipoRecurso] ?? recurso.tipoRecurso}
                        </p>
                        <p className="text-xs text-muted-foreground">{detalleRecurso(recurso)}</p>
                      </div>
                    </div>
                    <p className="text-sm tabular-nums">
                      {recurso.cantidad != null ? `Cantidad: ${recurso.cantidad}` : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {taller.observaciones && (
              <p className="text-xs text-muted-foreground">
                Observaciones del taller: {taller.observaciones}
              </p>
            )}
          </section>

          {/* Hospital y ubicación */}
          <section className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/40 p-3 dark:border-sky-900 dark:bg-sky-950/20">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              <MapPin className="h-3.5 w-3.5" />
              Hospital y ubicación
            </h3>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Dato etiqueta="Institución" valor={ubicacion?.institucion ?? '—'} />
              <Dato
                etiqueta="Región"
                valor={ubicacion?.nombreRegion ?? taller.region ?? '—'}
              />
              <Dato
                etiqueta="Estado"
                valor={ubicacion?.entidadFederativa ?? taller.entidadFederativa ?? '—'}
              />
              <Dato
                etiqueta="Ciudad / Municipio"
                valor={ubicacion?.ciudadMunicipio ?? taller.ciudadMunicipio ?? '—'}
              />
              <Dato etiqueta="Dirección" valor={direccion} />
              <Dato etiqueta="Correo de contacto" valor={ubicacion?.email ?? '—'} />
            </div>

            {lat != null && lon != null ? (
              <div className="space-y-2">
                <iframe
                  title="Ubicación del hospital"
                  className="h-52 w-full rounded-md border"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.008}%2C${lat - 0.008}%2C${lon + 0.008}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lon}`}
                />
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Abrir ubicación en Google Maps
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin coordenadas registradas para este hospital.
              </p>
            )}
          </section>

          {/* Historial de estados */}
          {historial.length > 0 && (
            <section className="space-y-2 rounded-lg border p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Historial de estados
              </h3>
              <ul className="space-y-1.5">
                {historial.map((evento) => (
                  <li
                    key={evento.idHistorial}
                    className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
                  >
                    {evento.estadoNuevo === 'Realizado' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : evento.estadoNuevo === 'Cancelado' ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : evento.estadoNuevo === 'EnCurso' ? (
                      <PlayCircle className="h-3.5 w-3.5 text-blue-600" />
                    ) : (
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      {evento.estadoAnterior ?? '—'} → {evento.estadoNuevo}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {evento.origen === 'Automatico' ? 'Automático' : 'Manual'}
                    </Badge>
                    <span className="text-muted-foreground">
                      {evento.nombreUsuario ?? 'Sistema'} ·{' '}
                      {new Date(evento.fecha).toLocaleString('es-MX')}
                    </span>
                    {evento.motivo && <span className="italic">“{evento.motivo}”</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
