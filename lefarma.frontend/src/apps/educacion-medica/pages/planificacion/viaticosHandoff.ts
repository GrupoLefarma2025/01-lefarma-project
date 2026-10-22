import { solicitudesApi } from '@/apps/viaticos/services/solicitudes.api';
import type { Asignacion } from '../../types/educacionMedica.types';

export interface RutaParaCotizar {
  idRuta: number;
  nombre: string;
  visitas: Asignacion[];
}

/** Un destino solo puede enviarse a cotizar si el hospital tiene coordenadas. */
export const tieneCoordenadas = (visita: Asignacion): boolean =>
  typeof visita.latitud === 'number' &&
  Number.isFinite(visita.latitud) &&
  typeof visita.longitud === 'number' &&
  Number.isFinite(visita.longitud);

/**
 * Construye el snapshot `solicitud-v2` que hidrata el asistente de Viáticos.
 * Solo incluye destinos con coordenadas; la hora no se envía (el usuario la
 * completa en el asistente si la necesita). Los datos que no vienen de la ruta
 * (origen, transporte, retorno) se dejan vacíos.
 */
export function construirSnapshotSolicitud(
  ruta: RutaParaCotizar,
  visitas: Asignacion[],
  nombreUsuario: string
): Record<string, unknown> {
  const seleccionadas = visitas.filter(tieneCoordenadas);

  const destinos = seleccionadas.map((visita, indice) => ({
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
    debeEstarHora: '',
    saleFecha: '',
    saleHora: '',
    hospedaje: {
      necesario: false,
      zona: 'actual',
      fechaEntrada: '',
      fechaSalida: '',
      hotel: null,
    },
  }));

  return {
    version: 'solicitud-v2',
    persona: {
      modo: 'mia',
      empleadoId: null,
      nombre: nombreUsuario.trim(),
      motivo: 'Talleres médicos en hospitales',
    },
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
      idSeleccionMensual: ruta.visitas[0]?.idSeleccionMensual ?? null,
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
  visitas: Asignacion[],
  nombreUsuario: string
): Promise<{ idSolicitud: number; folio: string | null; reutilizado: boolean }> {
  const seleccionadas = visitas.filter(tieneCoordenadas);
  if (seleccionadas.length === 0) {
    throw new Error('Selecciona al menos un hospital con coordenadas para cotizar.');
  }

  const datos = construirSnapshotSolicitud(ruta, seleccionadas, nombreUsuario);
  const respuesta = await solicitudesApi.crearDesdeEducacionMedica({
    id_ruta: ruta.idRuta,
    id_seleccion_mensual: seleccionadas[0]?.idSeleccionMensual ?? null,
    id_ruta_visitas: seleccionadas.map((visita) => visita.idRutaVisita),
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
