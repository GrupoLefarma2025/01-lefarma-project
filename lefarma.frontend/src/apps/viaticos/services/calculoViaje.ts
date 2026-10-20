import type { CostosRutaLugarInput, CostosRutaRequest, PuntoSeleccion } from '../types/costosRuta.types';
import type { Solicitud } from '../types/solicitud.types';
import { hidratarSolicitud } from './solicitudDraft';

const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const esHora = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function sumarHoras(fecha: string, hora: string, horas: number): { fecha: string; hora: string } | null {
  if (!esFecha(fecha) || !esHora(hora)) return null;
  const d = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + horas);
  const dos = (n: number) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
    hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
  };
}

function restarDias(fecha: string, dias: number): string {
  if (!esFecha(fecha)) return fecha;
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() - dias);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function nombreLugar(punto: PuntoSeleccion): string {
  const partes = [punto.municipio, punto.estado].filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return partes.length > 0 ? partes.join(', ') : punto.nombre;
}

export interface TramoViaje {
  desde: { punto: PuntoSeleccion; fecha: string; hora: string; nombre: string; explicita: boolean };
  hasta: { punto: PuntoSeleccion; fecha: string; hora: string; nombre: string };
  esRegreso: boolean;
}

/**
 * Divide el viaje en tramos: origen → destino 1 → … → regreso. Las salidas de
 * los destinos son opcionales: si faltan, se estima la salida 2 h después de la
 * llegada. El regreso usa como límite la salida del último destino + 2 h.
 */
export function construirTramos(solicitud: Solicitud): { tramos: TramoViaje[]; error: string | null } {
  const datos = hidratarSolicitud(solicitud.datos);
  if (!datos) return { tramos: [], error: 'La solicitud no tiene un snapshot reconocible.' };
  const origen = datos.origen.punto;
  if (!origen) return { tramos: [], error: 'El origen no tiene coordenadas.' };

  const destinos = datos.destinos.filter(
    (destino) => destino.punto && esFecha(destino.debeEstarFecha) && esHora(destino.debeEstarHora),
  );

  const tramos: TramoViaje[] = [];
  let desde = {
    punto: origen,
    fecha: datos.origen.fechaSalida,
    hora: datos.origen.horaSalida,
    nombre: nombreLugar(origen),
    explicita: Boolean(datos.origen.fechaSalida),
  };

  for (const destino of destinos) {
    if (!destino.punto) continue;
    tramos.push({
      desde,
      hasta: {
        punto: destino.punto,
        fecha: destino.debeEstarFecha,
        hora: destino.debeEstarHora,
        nombre: nombreLugar(destino.punto),
      },
      esRegreso: false,
    });
    const salida = destino.saleFecha && destino.saleHora
      ? { fecha: destino.saleFecha, hora: destino.saleHora }
      : sumarHoras(destino.debeEstarFecha, destino.debeEstarHora, 2);
    desde = {
      punto: destino.punto,
      fecha: salida?.fecha ?? '',
      hora: salida?.hora ?? '',
      nombre: nombreLugar(destino.punto),
      explicita: Boolean(destino.saleFecha),
    };
  }

  const regreso = datos.retorno.destino === 'origen' ? origen : datos.retorno.punto;
  if (regreso) {
    const limite = sumarHoras(desde.fecha, desde.hora, 2);
    tramos.push({
      desde,
      hasta: {
        punto: regreso,
        fecha: limite?.fecha ?? '',
        hora: limite?.hora ?? '',
        nombre: datos.retorno.destino === 'origen' ? 'Regreso al origen' : nombreLugar(regreso),
      },
      esRegreso: true,
    });
  }

  return tramos.length > 0
    ? { tramos, error: null }
    : { tramos: [], error: 'Agrega al menos un destino con fecha y hora de llegada.' };
}

function personaBase(solicitud: Solicitud): { nombre: string; carroPropio: boolean } {
  const datos = hidratarSolicitud(solicitud.datos);
  return {
    nombre: datos?.persona.nombre || 'Viajero',
    carroPropio: datos?.transporte.modo === 'propio',
  };
}

function requestConLugares(solicitud: Solicitud, lugares: CostosRutaLugarInput[], calcularHoteles: boolean): CostosRutaRequest {
  const { nombre, carroPropio } = personaBase(solicitud);
  return {
    opciones: {
      respetarHorarioLaboral: true,
      calcularHoteles,
      calcularViajesIntermedios: false,
      compartirViaje: false,
    },
    personas: [
      {
        nombre,
        carro_propio: carroPropio,
        gasolina: 'magna',
        draft: false,
        trabajo: { hora_entrada: '07:00', hora_salida: '18:30', primer_dia_laboral: 1, ultimo_dia_laboral: 5 },
        lugares,
      },
    ],
  };
}

/** Request del motor para un tramo normal o el regreso. */
export function construirRequestTramo(solicitud: Solicitud, tramo: TramoViaje): CostosRutaRequest {
  const salida: CostosRutaLugarInput = {
    orden: 1,
    tipo: 'salida',
    nombre: tramo.desde.nombre,
    latitud: tramo.desde.punto.latitud,
    longitud: tramo.desde.punto.longitud,
  };
  if (esFecha(tramo.desde.fecha) && esHora(tramo.desde.hora)) {
    salida.fecha_salida = tramo.desde.fecha;
    salida.hora_salida = tramo.desde.hora;
  }

  if (tramo.esRegreso) {
    return requestConLugares(solicitud, [
      salida,
      {
        orden: 2,
        tipo: 'punto',
        nombre: tramo.hasta.nombre,
        latitud: tramo.hasta.punto.latitud,
        longitud: tramo.hasta.punto.longitud,
        fecha_limite_llegada: tramo.hasta.fecha,
        hora_limite_llegada: tramo.hasta.hora,
      },
    ], false);
  }

  return requestConLugares(solicitud, [
    salida,
    {
      orden: 2,
      tipo: 'taller',
      nombre: tramo.hasta.nombre,
      latitud: tramo.hasta.punto.latitud,
      longitud: tramo.hasta.punto.longitud,
      fecha_inicio_actividad: tramo.hasta.fecha,
      hora_inicio_actividad: tramo.hasta.hora,
    },
  ], false);
}

/**
 * Request para la opción "salir el día anterior": origen → hotel (noche previa)
 * → primer destino. El motor propone hoteles cerca del destino.
 */
export function construirRequestHotel(solicitud: Solicitud, tramo: TramoViaje): CostosRutaRequest | null {
  const diaDestino = tramo.hasta.fecha;
  if (!esFecha(diaDestino) || !tramo.desde.punto) return null;
  const diaPrevio = restarDias(diaDestino, 1);
  const limite = sumarHoras(tramo.hasta.fecha, tramo.hasta.hora, -1);

  return requestConLugares(solicitud, [
    {
      orden: 1,
      tipo: 'salida',
      nombre: tramo.desde.nombre,
      latitud: tramo.desde.punto.latitud,
      longitud: tramo.desde.punto.longitud,
      fecha_salida: diaPrevio,
      hora_salida: '18:00',
    },
    {
      orden: 2,
      tipo: 'hotel',
      nombre: `Hotel cerca de ${tramo.hasta.nombre}`,
      latitud: tramo.hasta.punto.latitud,
      longitud: tramo.hasta.punto.longitud,
      fecha_llegada: diaPrevio,
      hora_llegada: '20:00',
      fecha_salida: limite?.fecha ?? diaDestino,
      hora_salida: limite?.hora ?? '06:00',
    },
    {
      orden: 3,
      tipo: 'taller',
      nombre: tramo.hasta.nombre,
      latitud: tramo.hasta.punto.latitud,
      longitud: tramo.hasta.punto.longitud,
      fecha_inicio_actividad: tramo.hasta.fecha,
      hora_inicio_actividad: tramo.hasta.hora,
    },
  ], true);
}

/**
 * Regreso con hotel: el viajero duerme en el último punto y regresa al día
 * siguiente. La ruta es último punto → hotel cercano → origen.
 */
export function construirRequestHotelRegreso(
  solicitud: Solicitud,
  tramo: TramoViaje,
): CostosRutaRequest | null {
  if (!tramo.esRegreso || !esFecha(tramo.desde.fecha) || !esHora(tramo.desde.hora)) return null;
  const diaHotel = tramo.desde.fecha;
  const diaSiguiente = sumarHoras(diaHotel, '12:00', 24)?.fecha ?? diaHotel;
  const checkIn = sumarHoras(diaHotel, tramo.desde.hora, 1);

  return requestConLugares(solicitud, [
    {
      orden: 1,
      tipo: 'salida',
      nombre: tramo.desde.nombre,
      latitud: tramo.desde.punto.latitud,
      longitud: tramo.desde.punto.longitud,
      fecha_salida: diaHotel,
      hora_salida: tramo.desde.hora,
    },
    {
      orden: 2,
      tipo: 'hotel',
      nombre: `Hotel cerca de ${tramo.desde.nombre}`,
      latitud: tramo.desde.punto.latitud,
      longitud: tramo.desde.punto.longitud,
      fecha_llegada: checkIn?.fecha ?? diaHotel,
      hora_llegada: checkIn?.hora ?? '20:00',
      fecha_salida: diaSiguiente,
      hora_salida: '06:00',
    },
    {
      orden: 3,
      tipo: 'punto',
      nombre: tramo.hasta.nombre,
      latitud: tramo.hasta.punto.latitud,
      longitud: tramo.hasta.punto.longitud,
      fecha_limite_llegada: diaSiguiente,
      hora_limite_llegada: '18:30',
    },
  ], true);
}
