import { describe, expect, it } from 'vitest';
import {
  construirSnapshotSolicitud,
  esEstadoRutaCotizable,
  tieneCoordenadas,
} from './viaticosHandoff';
import type { Asignacion } from '../../types/educacionMedica.types';

const crearAsignacion = (overrides: Partial<Asignacion> = {}): Asignacion => ({
  idRutaVisita: 1,
  idRuta: 7,
  nombreRuta: 'Ruta A',
  idSeleccionMensual: 3,
  idSeleccionHospital: 10,
  fechaVisita: '2026-10-16',
  orden: 1,
  idHospital: 100,
  nombreHospital: 'Hospital A',
  nombreRegion: 'Occidente',
  entidadFederativa: 'Jalisco',
  ciudadMunicipio: 'Guadalajara',
  institucion: 'IMSS',
  latitud: 20.6,
  longitud: -103.4,
  calle: null,
  colonia: null,
  codigoPostal: null,
  email: null,
  ...overrides,
});

describe('construirSnapshotSolicitud', () => {
  it('solo envía destinos con coordenadas y sin hora', () => {
    const conCoordenadas = crearAsignacion({ idRutaVisita: 1 });
    const sinCoordenadas = crearAsignacion({
      idRutaVisita: 2,
      nombreHospital: 'Sin coordenadas',
      latitud: null,
      longitud: null,
    });

    const datos = construirSnapshotSolicitud(
      { idRuta: 7, nombre: 'Ruta A', visitas: [conCoordenadas, sinCoordenadas] },
      [conCoordenadas, sinCoordenadas],
      'Ana Pérez'
    );

    expect(datos.version).toBe('solicitud-v2');
    expect((datos.persona as { nombre: string }).nombre).toBe('Ana Pérez');

    const destinos = datos.destinos as Array<{
      etiqueta: string;
      debeEstarHora: string;
      punto: { latitud: number };
    }>;
    expect(destinos).toHaveLength(1);
    expect(destinos[0].etiqueta).toBe('Hospital A');
    expect(destinos[0].debeEstarHora).toBe('');
    expect(destinos[0].punto.latitud).toBe(20.6);

    const origenEm = datos.origenEm as { idRuta: number; idRutaVisitas: number[] };
    expect(origenEm.idRuta).toBe(7);
    expect(origenEm.idRutaVisitas).toEqual([1]);
  });

  it('usa al especialista de la ruta como viajero de la cotización', () => {
    const visita = crearAsignacion();

    const datos = construirSnapshotSolicitud(
      { idRuta: 7, nombre: 'Ruta A', visitas: [visita] },
      [visita],
      'Ana Pérez',
      { idUsuario: 42, nombre: 'Dr. Roberto', rol: 'especialista' }
    );

    expect(datos.persona).toMatchObject({
      modo: 'otra',
      empleadoId: 42,
      nombre: 'Dr. Roberto',
    });
  });

  it('no envía destinos con coordenadas incompletas', () => {
    const valida = crearAsignacion({ idRutaVisita: 1 });
    const incompleta = crearAsignacion({ idRutaVisita: 2, latitud: null, longitud: -103 });

    expect(tieneCoordenadas(valida)).toBe(true);
    expect(tieneCoordenadas(incompleta)).toBe(false);

    const datos = construirSnapshotSolicitud(
      { idRuta: 7, nombre: 'Ruta A', visitas: [valida, incompleta] },
      [valida, incompleta],
      ''
    );

    expect(datos.destinos).toHaveLength(1);
  });
});

describe('esEstadoRutaCotizable', () => {
  it.each(['Archivada', 'Cancelada', 'Rechazada'])('bloquea la ruta %s', (estado) => {
    expect(esEstadoRutaCotizable(estado)).toBe(false);
  });

  it.each(['Creada', 'Cerrada'])('permite cotizar la ruta %s', (estado) => {
    expect(esEstadoRutaCotizable(estado)).toBe(true);
  });

  it('no considera cotizable una ruta sin estado', () => {
    expect(esEstadoRutaCotizable(null)).toBe(false);
  });
});
