import type { PuntoSeleccion } from '../types/costosRuta.types';
import type {
  AcompananteV2,
  DestinoV2,
  HospedajeV2,
  OrigenV2,
  PasoPersonaV2,
  PasoTransporteV2,
  RetornoV2,
} from '../types/wizardV2.types';

export interface BorradorHidratado {
  persona: PasoPersonaV2;
  transporte: PasoTransporteV2;
  origen: OrigenV2;
  destinos: DestinoV2[];
  retorno: RetornoV2;
}

const HOSPEDAJE_VACIO: HospedajeV2 = {
  necesario: false,
  zona: 'actual',
  fechaEntrada: '',
  fechaSalida: '',
  hotel: null,
};

function comoObjeto(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function punto(v: unknown): PuntoSeleccion | null {
  const o = comoObjeto(v);
  if (!o) return null;
  const latitud = numero(o.latitud);
  const longitud = numero(o.longitud);
  if (latitud === null || longitud === null) return null;
  return {
    nombre: texto(o.nombre) || 'Punto seleccionado en mapa',
    latitud,
    longitud,
    estado: typeof o.estado === 'string' ? o.estado : undefined,
    municipio: typeof o.municipio === 'string' ? o.municipio : undefined,
  };
}

function hospedaje(v: unknown): HospedajeV2 {
  const o = comoObjeto(v);
  if (!o) return { ...HOSPEDAJE_VACIO };
  return {
    necesario: o.necesario === true,
    zona: o.zona === 'anterior' ? 'anterior' : 'actual',
    fechaEntrada: texto(o.fechaEntrada),
    fechaSalida: texto(o.fechaSalida),
    hotel: (comoObjeto(o.hotel) as unknown as HospedajeV2['hotel']) ?? null,
  };
}

function destinoVacio(indice: number): DestinoV2 {
  return {
    id: `dest-edit-${indice}`,
    punto: null,
    debeEstarFecha: '',
    debeEstarHora: '',
    saleFecha: '',
    saleHora: '',
    hospedaje: { ...HOSPEDAJE_VACIO },
    cotizacion: null,
  };
}

/**
 * Reconstruye el estado del wizard desde el snapshot `datos` de un borrador.
 * Devuelve `null` si el documento no es `solicitud-v2`.
 */
export function hidratarSolicitud(datos: unknown): BorradorHidratado | null {
  const d = comoObjeto(datos);
  if (!d || d.version !== 'solicitud-v2') return null;

  const persona = comoObjeto(d.persona);
  const transporte = comoObjeto(d.transporte);
  const origen = comoObjeto(d.origen);
  const retorno = comoObjeto(d.retorno);

  const acompanantes: AcompananteV2[] = (Array.isArray(transporte?.acompanantes) ? transporte!.acompanantes : [])
    .map((item) => {
      const a = comoObjeto(item);
      const directorioId = numero(a?.directorioId);
      const nombreCompleto = texto(a?.nombreCompleto).trim();
      if (directorioId === null || nombreCompleto === '') return null;
      return {
        directorioId,
        nombreCompleto,
        correo: typeof a?.correo === 'string' ? a.correo : null,
      };
    })
    .filter((a): a is AcompananteV2 => a !== null);

  const destinos = (Array.isArray(d.destinos) ? d.destinos : []).map((item, i) => {
    const destino = comoObjeto(item);
    const base = destinoVacio(i + 1);
    if (!destino) return base;
    return {
      ...base,
      punto: punto(destino.punto),
      etiqueta: typeof destino.etiqueta === 'string' ? destino.etiqueta : undefined,
      debeEstarFecha: texto(destino.debeEstarFecha),
      debeEstarHora: texto(destino.debeEstarHora),
      saleFecha: texto(destino.saleFecha),
      saleHora: texto(destino.saleHora),
      hospedaje: hospedaje(destino.hospedaje),
    };
  });

  if (destinos.length === 0) {
    destinos.push(destinoVacio(1));
  }

  return {
    persona: {
      modo: persona?.modo === 'otra' ? 'otra' : 'mia',
      empleadoId: numero(persona?.empleadoId),
      nombre: texto(persona?.nombre).trim(),
      motivo: texto(persona?.motivo),
    },
    transporte: {
      modo: transporte?.modo === 'propio' ? 'propio' : 'solicitado',
      compartir: transporte?.compartir === true || acompanantes.length > 0,
      acompanantes,
    },
    origen: {
      punto: punto(origen?.punto),
      fechaSalida: texto(origen?.fechaSalida),
      horaSalida: texto(origen?.horaSalida),
    },
    destinos,
    retorno: {
      necesario: true,
      llegadaRequeridaFecha: texto(retorno?.llegadaRequeridaFecha),
      llegadaRequeridaHora: texto(retorno?.llegadaRequeridaHora),
      destino: retorno?.destino === 'otro' ? 'otro' : 'origen',
      punto: punto(retorno?.punto),
    },
  };
}
