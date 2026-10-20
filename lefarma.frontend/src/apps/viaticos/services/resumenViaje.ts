import type { PuntoSeleccion } from '../types/costosRuta.types';

/** Destino mínimo que necesita el resumen (compatible con DestinoV2 y con datos guardados). */
export interface ResumenDestino {
  id?: string | number;
  etiqueta?: string;
  punto: PuntoSeleccion | null;
  debeEstarFecha?: string;
  debeEstarHora?: string;
  saleFecha?: string;
  saleHora?: string;
}

/** Datos que pinta el resumen del viaje (paso 7 del wizard y detalle en Mis viajes). */
export interface ResumenViajeDatos {
  motivo: string;
  modoTransporte: 'propio' | 'solicitado';
  compartido: boolean;
  acompanantes: string[];
  origen: { punto: PuntoSeleccion | null; fechaSalida?: string; horaSalida?: string };
  destinos: ResumenDestino[];
  retorno: { destino: 'origen' | 'otro'; punto: PuntoSeleccion | null };
  rango: { inicio: string | null; fin: string | null };
}

function comoObjeto(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function texto(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function comoPunto(v: unknown): PuntoSeleccion | null {
  const o = comoObjeto(v);
  if (!o) return null;
  const latitud = typeof o.latitud === 'number' ? o.latitud : Number.NaN;
  const longitud = typeof o.longitud === 'number' ? o.longitud : Number.NaN;
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  return {
    nombre: texto(o.nombre) ?? 'Punto',
    latitud,
    longitud,
    estado: texto(o.estado),
    municipio: texto(o.municipio),
  };
}

/**
 * Reconstruye el resumen desde el snapshot `datos` guardado por el wizard.
 * Devuelve `null` cuando el documento no es `solicitud-v2` (flujo legado),
 * para que el llamador decida el fallback.
 */
export function resumenDesdeDatos(datos: unknown): ResumenViajeDatos | null {
  const d = comoObjeto(datos);
  if (!d || d.version !== 'solicitud-v2' || !Array.isArray(d.destinos)) return null;

  const persona = comoObjeto(d.persona);
  const transporte = comoObjeto(d.transporte);
  const origen = comoObjeto(d.origen);
  const retorno = comoObjeto(d.retorno);
  const rango = comoObjeto(d.rango);

  const acompanantes = (Array.isArray(transporte?.acompanantes) ? transporte!.acompanantes : [])
    .map((item) => {
      const acompanante = comoObjeto(item);
      return texto(acompanante?.nombreCompleto) ?? texto(acompanante?.nombre);
    })
    .filter((nombre): nombre is string => typeof nombre === 'string');

  return {
    motivo: texto(persona?.motivo) ?? '',
    modoTransporte: transporte?.modo === 'propio' ? 'propio' : 'solicitado',
    compartido: transporte?.compartir === true || acompanantes.length > 0,
    acompanantes,
    origen: {
      punto: comoPunto(origen?.punto),
      fechaSalida: texto(origen?.fechaSalida),
      horaSalida: texto(origen?.horaSalida),
    },
    destinos: d.destinos.map((item) => {
      const destino = comoObjeto(item);
      return {
        etiqueta: texto(destino?.etiqueta),
        punto: comoPunto(destino?.punto),
        debeEstarFecha: texto(destino?.debeEstarFecha),
        debeEstarHora: texto(destino?.debeEstarHora),
        saleFecha: texto(destino?.saleFecha),
        saleHora: texto(destino?.saleHora),
      };
    }),
    retorno: {
      destino: retorno?.destino === 'otro' ? 'otro' : 'origen',
      punto: comoPunto(retorno?.punto),
    },
    rango: { inicio: texto(rango?.inicio) ?? null, fin: texto(rango?.fin) ?? null },
  };
}

/** Cantidad de puntos a visitar (destinos) guardados en el snapshot. */
export function contarPuntos(datos: unknown): number {
  const d = comoObjeto(datos);
  return Array.isArray(d?.destinos) ? d.destinos.length : 0;
}
