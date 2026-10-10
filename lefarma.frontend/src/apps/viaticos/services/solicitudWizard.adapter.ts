import type { Sucursal } from '@/types/catalogo.types';
import type {
  CostosRutaLugarInput,
  CostosRutaRequest,
} from '../types/costosRuta.types';
import type {
  DestinoV2,
  ModoTransporteV2,
  OrigenV2,
  RetornoV2,
} from '../types/wizardV2.types';

/**
 * Frontera tipada entre el asistente nuevo y el algoritmo legacy.
 *
 * REGLA: este adaptador solo CONSTRUYE `CostosRutaRequest` para
 * `POST /viaticos/costos-ruta/calcular`. Nunca envía un esquema distinto al
 * endpoint legacy y nunca modifica `costosRutaForm.ts` ni el backend.
 */

export const MONEDA_PERMITIDA = 'MXN';

/** Jornada por defecto: no se vuelve a pedir en el asistente nuevo. */
const TRABAJO_POR_DEFECTO = {
  hora_entrada: '08:00',
  hora_salida: '18:30',
  primer_dia_laboral: 1,
  ultimo_dia_laboral: 5,
} as const;

export interface AdaptarTramoArgs {
  nombreViajero: string;
  modoTransporte: ModoTransporteV2;
  origen: OrigenV2;
  destino: DestinoV2;
  sucursales: Sucursal[];
}

export interface AdaptarTramoSalida {
  request: CostosRutaRequest | null;
  errors: string[];
}

const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const esHora = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function lugarOrigen(origen: OrigenV2, sucursales: Sucursal[], errors: string[]): CostosRutaLugarInput | null {
  if (origen.tipo === 'mapa' || origen.punto) {
    const punto = origen.punto;
    if (!punto || !punto.nombre.trim()) {
      errors.push('Origen: selecciona un punto del mapa con nombre.');
      return null;
    }
    if (!Number.isFinite(punto.latitud) || !Number.isFinite(punto.longitud) || (punto.latitud === 0 && punto.longitud === 0)) {
      errors.push(`Origen: el punto «${punto.nombre}» no tiene coordenadas válidas.`);
      return null;
    }
    return { orden: 1, tipo: 'salida', nombre: punto.nombre.trim(), latitud: punto.latitud, longitud: punto.longitud };
  }
  const sucursal = sucursales.filter((s) => s.activo).find((s) => s.idSucursal === origen.sucursalId);
  if (!sucursal) {
    errors.push('Origen: selecciona una sucursal activa del catálogo.');
    return null;
  }
  if (!Number.isFinite(sucursal.latitud) || !Number.isFinite(sucursal.longitud) || (sucursal.latitud === 0 && sucursal.longitud === 0)) {
    errors.push(`Origen: «${sucursal.nombre}» no tiene coordenadas válidas en el catálogo. Corrige el catálogo antes de calcular.`);
    return null;
  }
  return { orden: 1, tipo: 'salida', nombre: sucursal.nombre, latitud: sucursal.latitud, longitud: sucursal.longitud };
}

/**
 * Un tramo = origen + UN destino. El endpoint legacy calcula el tramo completo;
 * el asistente llama una vez por tramo para la comparación incremental.
 */
export function adaptarTramoACostosRuta(args: AdaptarTramoArgs): AdaptarTramoSalida {
  const errors: string[] = [];
  const nombre = args.nombreViajero.trim();
  if (!nombre) errors.push('Persona: falta el nombre de la persona viajera.');

  const salida = lugarOrigen(args.origen, args.sucursales, errors);
  if (salida) {
    if (!esFecha(args.origen.fechaSalida) || !esHora(args.origen.horaSalida)) {
      errors.push('Origen: indica fecha y hora de salida válidas.');
    } else {
      salida.fecha_salida = args.origen.fechaSalida;
      salida.hora_salida = args.origen.horaSalida;
    }
  }

  const punto = args.destino.punto;
  let taller: CostosRutaLugarInput | null = null;
  if (!punto || !punto.nombre.trim()) {
    errors.push('Destino: selecciona un resultado del mapa con coordenadas.');
  } else if (!Number.isFinite(punto.latitud) || !Number.isFinite(punto.longitud) || (punto.latitud === 0 && punto.longitud === 0)) {
    errors.push(`Destino: el punto «${punto.nombre}» no tiene coordenadas válidas.`);
  } else {
    taller = {
      orden: 2,
      tipo: 'taller',
      nombre: punto.nombre.trim(),
      latitud: punto.latitud,
      longitud: punto.longitud,
    };
  }

  const d = args.destino;
  if (!esFecha(d.debeEstarFecha) || !esHora(d.debeEstarHora)) errors.push('Destino: indica fecha y hora en que debes estar ahí.');
  if (!esFecha(d.saleFecha) || !esHora(d.saleHora)) errors.push('Destino: indica fecha y hora de salida de ese destino.');
  if (
    esFecha(d.debeEstarFecha) && esHora(d.debeEstarHora) && esFecha(d.saleFecha) && esHora(d.saleHora) &&
    `${d.saleFecha}T${d.saleHora}` < `${d.debeEstarFecha}T${d.debeEstarHora}`
  ) {
    errors.push('Destino: la salida no puede ser anterior a la llegada requerida.');
  }

  if (errors.length > 0 || !salida || !taller) return { request: null, errors };

  taller.fecha_inicio_actividad = d.debeEstarFecha;
  taller.hora_inicio_actividad = d.debeEstarHora;
  taller.fecha_fin_actividad = d.saleFecha;
  taller.hora_fin_actividad = d.saleHora;

  return {
    request: {
      opciones: {
        respetarHorarioLaboral: true,
        calcularHoteles: d.hospedaje.necesario,
        calcularViajesIntermedios: false,
        compartirViaje: false,
      },
      personas: [
        {
          nombre,
          carro_propio: args.modoTransporte === 'propio',
          // Carro propio SIEMPRE usa Magna; en modo solicitado el combustible
          // lo pone el proveedor, así que Magna es solo el valor del contrato.
          gasolina: 'magna',
          draft: false,
          trabajo: { ...TRABAJO_POR_DEFECTO },
          lugares: [salida, taller],
        },
      ],
    },
    errors,
  };
}

/** Rango total derivado de la cronología. No se captura como paso inicial. */
export function rangoDelViaje(
  origen: OrigenV2,
  destinos: DestinoV2[],
  retorno: RetornoV2,
): { inicio: string | null; fin: string | null } {
  const fechas: string[] = [];
  if (esFecha(origen.fechaSalida)) fechas.push(origen.fechaSalida);
  for (const d of destinos) {
    if (esFecha(d.debeEstarFecha)) fechas.push(d.debeEstarFecha);
    if (esFecha(d.saleFecha)) fechas.push(d.saleFecha);
    if (d.hospedaje.necesario) {
      if (esFecha(d.hospedaje.fechaEntrada)) fechas.push(d.hospedaje.fechaEntrada);
      if (esFecha(d.hospedaje.fechaSalida)) fechas.push(d.hospedaje.fechaSalida);
    }
  }
  if (retorno.necesario) {
    if (esFecha(retorno.saleFecha)) fechas.push(retorno.saleFecha);
    if (esFecha(retorno.llegadaRequeridaFecha)) fechas.push(retorno.llegadaRequeridaFecha);
  }
  if (fechas.length === 0) return { inicio: null, fin: null };
  fechas.sort();
  return { inicio: fechas[0], fin: fechas[fechas.length - 1] };
}

/** Verdadero cuando hay más de una moneda: el prototipo no las suma. */
export function hayMonedaMezclada(opciones: { moneda: string | null }[]): boolean {
  return new Set(opciones.map((o) => o.moneda ?? MONEDA_PERMITIDA)).size > 1;
}

/** Solo el avión pregunta por equipaje documentado. */
export function esOfertaVuelo(oferta: { modo: string }): boolean {
  return oferta.modo === 'avion';
}

/**
 * Preselección de origen: solo cuando el catálogo real trae «Antonio Maura»
 * con coordenadas válidas. Nunca se fabrican identificadores ni coordenadas.
 */
export function sugerirOrigenInicial(sucursales: Sucursal[]): number | null {
  const candidata = sucursales
    .filter((s) => s.activo)
    .find((s) => s.nombre.trim().toLocaleLowerCase('es-MX') === 'antonio maura');
  if (!candidata) return null;
  if (!Number.isFinite(candidata.latitud) || !Number.isFinite(candidata.longitud)) return null;
  if (candidata.latitud === 0 && candidata.longitud === 0) return null;
  return candidata.idSucursal;
}
