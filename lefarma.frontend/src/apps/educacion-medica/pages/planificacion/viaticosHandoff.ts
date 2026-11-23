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
  horaSalida?: string | null;
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
  gerencia?: string | null;
  visitas: VisitaCotizable[];
  viajero?: ViajeroCotizacion;
}

const ESTADOS_RUTA_NO_COTIZABLES = new Set(['Archivada', 'Cancelada', 'Rechazada']);

export const esEstadoRutaCotizable = (estado: string | null | undefined): boolean =>
  estado != null && !ESTADOS_RUTA_NO_COTIZABLES.has(estado);

export const tieneCoordenadas = (visita: VisitaCotizable): boolean =>
  typeof visita.latitud === 'number' &&
  Number.isFinite(visita.latitud) &&
  typeof visita.longitud === 'number' &&
  Number.isFinite(visita.longitud);

const horaCorta = (hora: string | null | undefined): string => (hora ?? '').slice(0, 5);

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
    origenEm: {
      idRuta: ruta.idRuta,
      nombreRuta: ruta.nombre,
      idSeleccionMensual: ruta.idSeleccionMensual ?? ruta.visitas[0]?.idSeleccionMensual ?? null,
      idRutaVisitas: seleccionadas.map((visita) => visita.idRutaVisita),
    },
  };
}

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
