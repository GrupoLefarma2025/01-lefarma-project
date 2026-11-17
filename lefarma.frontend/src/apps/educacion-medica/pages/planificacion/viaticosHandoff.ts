import { solicitudesApi } from '@/apps/viaticos/services/solicitudes.api';

export interface VisitaCotizable {
  idRutaVisita: number;
  idRuta: number;
  idSeleccionMensual?: number | null;
  fechaVisita: string;
  orden: number;
  nombreHospital: string | null;
  nombreRegion?: string | null;
  entidadFederativa?: string | null;
  ciudadMunicipio?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  /** TimeOnly del backend: 'HH:mm:ss'. */
  horaSalida?: string | null;
  /** TimeOnly del backend: 'HH:mm:ss'. */
  horaLlegada?: string | null;
}

export interface ViajeroCotizacion {
  idUsuario: number;
  nombre: string;
  rol: 'especialista' | 'ejecutivo';
}

export interface RutaParaCotizar {
  idRuta: number;
  nombre: string;
  idSeleccionMensual?: number | null;
  /** Gerencia de la selección (Descentralizado / IMSS / IMSS Bienestar). */
  gerencia?: string | null;
  visitas: VisitaCotizable[];
  viajero?: ViajeroCotizacion;
}

const ESTADOS_RUTA_NO_COTIZABLES = new Set(['Archivada', 'Cancelada', 'Rechazada']);

/** Una ruta archivada, cancelada o rechazada ya no puede generar cotizaciones. */
export const esEstadoRutaCotizable = (estado: string | null | undefined): boolean =>
  estado != null && !ESTADOS_RUTA_NO_COTIZABLES.has(estado);

/** Un destino solo puede enviarse a cotizar si el hospital tiene coordenadas. */
export const tieneCoordenadas = (visita: VisitaCotizable): boolean =>
  typeof visita.latitud === 'number' &&
  Number.isFinite(visita.latitud) &&
  typeof visita.longitud === 'number' &&
  Number.isFinite(visita.longitud);

/** TimeOnly del backend ('HH:mm:ss') al formato del wizard ('HH:mm'). */
const horaCorta = (hora: string | null | undefined): string => (hora ?? '').slice(0, 5);

/**
 * Construye el snapshot `solicitud-v2` que hidrata el asistente de Viáticos.
 * Solo incluye destinos con coordenadas; la hora no se envía (el usuario la
 * completa en el asistente si la necesita). Los datos que no vienen de la ruta
 * (origen, transporte, retorno) se dejan vacíos.
 */
export function construirSnapshotSolicitud(
  ruta: RutaParaCotizar,
  visitas: VisitaCotizable[],
  nombreUsuario: string,
  viajero?: ViajeroCotizacion,
  idUsuario?: number
): Record<string, unknown> {
  const seleccionadas = visitas.filter(tieneCoordenadas);
  const esMismoUsuario =
    viajero != null && idUsuario != null && viajero.idUsuario === idUsuario;
  const persona =
    viajero && viajero.idUsuario > 0
      ? {
          modo: esMismoUsuario ? 'mia' : 'otra',
          empleadoId: esMismoUsuario ? null : viajero.idUsuario,
          nombre: viajero.nombre.trim(),
          motivo: 'Talleres médicos en hospitales',
        }
      : {
          modo: 'mia',
          empleadoId: null,
          nombre: nombreUsuario.trim(),
          motivo: 'Talleres médicos en hospitales',
        };

  // Si la ruta ocupa más de un día, se propone hotel al cerrar el día que
  // todavía tiene visitas al día siguiente. El usuario puede desmarcarlo en
  // el asistente; esto solo evita que un viaje de varios días nazca sin hotel.
  const fechas = new Set(seleccionadas.map((visita) => visita.fechaVisita));
  const multiDia = fechas.size > 1;

  const destinos = seleccionadas.map((visita, indice) => {
    const siguiente = seleccionadas[indice + 1];
    const necesitaHotel =
      multiDia && siguiente !== undefined && siguiente.fechaVisita > visita.fechaVisita;
    return {
      id: `em-${visita.idRutaVisita}`,
      punto: {
        nombre: visita.nombreHospital ?? `Hospital ${indice + 1}`,
        latitud: Number(visita.latitud),
        longitud: Number(visita.longitud),
        estado: visita.entidadFederativa ?? undefined,
        municipio: visita.ciudadMunicipio ?? undefined,
      },
      etiqueta: visita.nombreHospital ?? `Destino ${indice + 1}`,
      debeEstarFecha: visita.fechaVisita,
      debeEstarHora: horaCorta(visita.horaLlegada),
      saleFecha: '',
      saleHora: '',
      hospedaje: {
        necesario: necesitaHotel,
        zona: 'actual',
        fechaEntrada: '',
        fechaSalida: '',
        hotel: null,
      },
    };
  });

  return {
    version: 'solicitud-v2',
    persona,
    transporte: {
      modo: 'solicitado',
      compartir: false,
      acompanantes: [],
    },
    origen: {
      punto: null,
      fechaSalida: '',
      horaSalida: '',
    },
    destinos,
    retorno: {
      necesario: true,
      llegadaRequeridaFecha: '',
      llegadaRequeridaHora: '',
      destino: 'origen',
      punto: null,
    },
    // Trazabilidad del handoff; el asistente ignora las claves que no conoce.
    origenEm: {
      idRuta: ruta.idRuta,
      nombreRuta: ruta.nombre,
      idSeleccionMensual: ruta.idSeleccionMensual ?? ruta.visitas[0]?.idSeleccionMensual ?? null,
      idRutaVisitas: seleccionadas.map((visita) => visita.idRutaVisita),
    },
  };
}

/**
 * Crea o reutiliza la cotización de viáticos de una ruta (ADR-00014).
 * El backend decide la reutilización por ruta + conjunto exacto de visitas y
 * bloquea las visitas que ya están en una cotización activa. Solo los
 * hospitales con coordenadas se envían.
 */
export async function crearBorradorDesdeRuta(
  ruta: RutaParaCotizar,
  visitas: VisitaCotizable[],
  nombreUsuario: string,
  idUsuario?: number
): Promise<{ idSolicitud: number; folio: string | null; reutilizado: boolean }> {
  const seleccionadas = visitas.filter(tieneCoordenadas);
  if (seleccionadas.length === 0) {
    throw new Error('Selecciona al menos un hospital con coordenadas para cotizar.');
  }

  const datos = construirSnapshotSolicitud(
    ruta,
    seleccionadas,
    nombreUsuario,
    ruta.viajero,
    idUsuario,
  );
  const respuesta = await solicitudesApi.crearDesdeEducacionMedica({
    id_ruta: ruta.idRuta,
    id_seleccion_mensual: ruta.idSeleccionMensual ?? seleccionadas[0]?.idSeleccionMensual ?? null,
    id_ruta_visitas: seleccionadas.map((visita) => visita.idRutaVisita),
    ...(ruta.gerencia ? { gerencia: ruta.gerencia } : {}),
    datos,
  });

  if (!respuesta.data.success || !respuesta.data.data) {
    throw new Error(respuesta.data.message ?? 'No se pudo crear el borrador de viáticos.');
  }

  return {
    idSolicitud: respuesta.data.data.id_solicitud,
    folio: respuesta.data.data.folio,
    reutilizado: respuesta.data.data.reutilizado,
  };
}
