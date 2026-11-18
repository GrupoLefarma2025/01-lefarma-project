import { describe, expect, it } from 'vitest';
import {
  construirRequestHotel,
  construirRequestHotelDespues,
  type TramoViaje,
} from './calculoViaje';
import type { PuntoSeleccion } from '../types/costosRuta.types';
import type { Solicitud } from '../types/solicitud.types';

const punto = (
  nombre: string,
  latitud: number,
  longitud: number,
  municipio: string,
): PuntoSeleccion => ({ nombre, latitud, longitud, municipio, estado: 'Jalisco' });

const tramo = (
  desde: { punto: PuntoSeleccion; fecha: string; hora: string; nombre: string },
  hasta: { punto: PuntoSeleccion; fecha: string; hora: string; nombre: string },
  esRegreso = false,
): TramoViaje => ({
  desde: { ...desde, explicita: true },
  hasta,
  esRegreso,
});

const solicitud: Solicitud = {
  id_solicitud: 42,
  id_usuario_solicitante: 7,
  periodo: '2026-11',
  gerencia: 'Operaciones',
  estado: 'enviada',
  activo: true,
  fecha_creacion: '2026-11-05T12:00:00',
  fecha_modificacion: '2026-11-05T12:00:00',
  datos: {
    version: 'solicitud-v2',
    persona: { modo: 'mia', nombre: 'Persona Viajera' },
    transporte: { modo: 'solicitado', compartir: false, acompanantes: [] },
    origen: {
      punto: punto('Guadalajara', 20.67, -103.34, 'Guadalajara'),
      fechaSalida: '2026-11-10',
      horaSalida: '08:00',
    },
    destinos: [],
    retorno: { destino: 'origen' },
  },
  opciones: [],
  eventos: [],
};

const guadalajara = punto('Guadalajara', 20.67, -103.34, 'Guadalajara');
const zapopan = punto('Zapopan', 20.72, -103.39, 'Zapopan');
const leon = punto('León', 21.12, -101.68, 'León');

describe('construirRequestHotel (noche antes)', () => {
  it('usa las coordenadas y el nombre del hotel elegido', () => {
    const request = construirRequestHotel(
      solicitud,
      tramo(
        { punto: guadalajara, fecha: '2026-11-10', hora: '18:00', nombre: 'Guadalajara' },
        { punto: zapopan, fecha: '2026-11-11', hora: '10:00', nombre: 'Zapopan' },
      ),
      { nombre: 'Hotel Centro', latitud: 20.72, longitud: -103.39 },
    );

    const lugares = request!.personas[0].lugares;
    expect(lugares[0]).toMatchObject({ tipo: 'salida', fecha_salida: '2026-11-10', hora_salida: '18:00' });
    expect(lugares[1]).toMatchObject({
      tipo: 'hotel',
      nombre: 'Hotel Centro',
      latitud: 20.72,
      longitud: -103.39,
      fecha_llegada: '2026-11-10',
      hora_llegada: '20:00',
      fecha_salida: '2026-11-11',
      hora_salida: '09:00',
    });
    expect(lugares[2]).toMatchObject({ tipo: 'taller', fecha_inicio_actividad: '2026-11-11', hora_inicio_actividad: '10:00' });
  });

  it('si el hotel de referencia viene en (0,0), usa el punto de búsqueda', () => {
    const request = construirRequestHotel(
      solicitud,
      tramo(
        { punto: guadalajara, fecha: '2026-11-10', hora: '18:00', nombre: 'Guadalajara' },
        { punto: zapopan, fecha: '2026-11-11', hora: '10:00', nombre: 'Zapopan' },
      ),
      { nombre: 'Hotel de referencia', latitud: 0, longitud: 0 },
    );

    expect(request!.personas[0].lugares[1]).toMatchObject({
      tipo: 'hotel',
      nombre: 'Hotel de referencia',
      latitud: 20.72,
      longitud: -103.39,
    });
  });
});

describe('construirRequestHotelDespues (noche después)', () => {
  it('duerme cerca del destino anterior y sale al día siguiente hacia el siguiente destino', () => {
    const request = construirRequestHotelDespues(
      solicitud,
      tramo(
        { punto: zapopan, fecha: '2026-11-10', hora: '18:00', nombre: 'Zapopan' },
        { punto: leon, fecha: '2026-11-12', hora: '10:00', nombre: 'León' },
      ),
      { nombre: 'Hotel Centro', latitud: 20.72, longitud: -103.39 },
    );

    const lugares = request!.personas[0].lugares;
    expect(lugares[0]).toMatchObject({ tipo: 'salida', fecha_salida: '2026-11-10', hora_salida: '18:00' });
    expect(lugares[1]).toMatchObject({
      tipo: 'hotel',
      nombre: 'Hotel Centro',
      latitud: 20.72,
      longitud: -103.39,
      fecha_llegada: '2026-11-10',
      hora_llegada: '19:00',
      fecha_salida: '2026-11-12',
      hora_salida: '06:30',
    });
    expect(lugares[2]).toMatchObject({
      tipo: 'taller',
      fecha_inicio_actividad: '2026-11-12',
      hora_inicio_actividad: '10:00',
    });
  });

  it('en el regreso usa el punto de llegada como límite del día siguiente', () => {
    const request = construirRequestHotelDespues(
      solicitud,
      tramo(
        { punto: leon, fecha: '2026-11-12', hora: '18:00', nombre: 'León' },
        { punto: guadalajara, fecha: '2026-11-13', hora: '18:30', nombre: 'Guadalajara' },
        true,
      ),
      { nombre: 'Hotel Centro', latitud: 21.12, longitud: -101.68 },
    );

    const lugares = request!.personas[0].lugares;
    expect(lugares[1]).toMatchObject({
      tipo: 'hotel',
      fecha_llegada: '2026-11-12',
      hora_llegada: '19:00',
      fecha_salida: '2026-11-13',
      hora_salida: '06:30',
    });
    expect(lugares[2]).toMatchObject({
      tipo: 'punto',
      fecha_limite_llegada: '2026-11-13',
      hora_limite_llegada: '18:30',
    });
  });

  it('no propone noche después si el siguiente destino es el mismo día', () => {
    expect(construirRequestHotelDespues(
      solicitud,
      tramo(
        { punto: zapopan, fecha: '2026-11-10', hora: '14:00', nombre: 'Zapopan' },
        { punto: leon, fecha: '2026-11-10', hora: '18:00', nombre: 'León' },
      ),
    )).toBeNull();
  });
});
