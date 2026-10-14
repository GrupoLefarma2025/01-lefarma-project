import { describe, expect, it } from 'vitest';
import type { Sucursal } from '@/types/catalogo.types';
import type { HospitalUbicacion } from '@/apps/educacion-medica/types/educacionMedica.types';
import { aplicarEjemplo, VIAJES_EJEMPLO } from './costosRutaEjemplos';

const branch = (id: number, ciudad: string): Sucursal => ({ idSucursal: id, idEmpresa: 1,
  nombre: `Branch ${id}`, ciudad, latitud: 19, longitud: -99, numeroEmpleados: 0,
  activo: true, fechaCreacion: '2026-01-01' });
const hospital = (id: number, name: string, city: string): HospitalUbicacion => ({
  codigoContacto: id, nombreContacto: name, nombreCorto: null, clues: null, ciudad: city,
  codigoEstado: null, latitud: 19, longitud: -99, idRegion: null, regionNombre: null,
});
const ids = { personId: 1, primeroDestinoId: 10 };

describe('primary October workbook examples', () => {
  it('preserves all twenty original FOR-008 ranges and source terminal departures', () => {
    const ranges = [[5,5],[5,9],[7,9],[12,14],[12,14],[12,16],[13,16],[13,16],[15,16],
      [19,20],[19,23],[20,21],[22,23],[23,23],[26,26],[26,27],[26,30],[27,28],[27,30],[29,30]];
    const times = ['05:00','12:00','05:00','05:00','15:00','08:00','14:00','06:00','15:00','06:00',
      '14:00','06:00','05:00','05:00','05:00','06:00','08:00','05:00','14:00','06:00'];
    expect(VIAJES_EJEMPLO).toHaveLength(20);
    VIAJES_EJEMPLO.forEach((trip, index) => {
      const iso = (day: number) => `2026-10-${String(day).padStart(2, '0')}`;
      expect(trip).toMatchObject({ inicio: iso(ranges[index][0]), fin: iso(ranges[index][1]),
        salidaFecha: iso(ranges[index][0]), salidaHora: times[index] });
      for (const stop of trip.destinos) {
        expect(stop.fecha >= trip.inicio && stop.fecha <= trip.fin).toBe(true);
        expect(stop.hospital).toBeTruthy();
      }
    });
  });

  it('keeps documented same-day visits and never replaces return travel with outbound', () => {
    const v3 = VIAJES_EJEMPLO[2];
    expect(v3.destinos.map(d => d.fecha)).toEqual(['2026-10-07','2026-10-07','2026-10-08','2026-10-09']);
    expect(v3).toMatchObject({ salidaHora: '05:00', transporte: 'bus' });
    expect(VIAJES_EJEMPLO[12]).toMatchObject({ salidaHora: '05:00', transporte: 'bus' });
    expect(VIAJES_EJEMPLO[9]).toMatchObject({ vueloHora: '08:35' });
  });

  it('does not choose a hospital by city, nor an ambiguous exact identity', () => {
    const trip = VIAJES_EJEMPLO[0];
    expect(aplicarEjemplo(trip, [branch(1, 'CDMX')], [hospital(2, 'Other hospital', 'Toluca')], ids).person.destinations[0].hospitalId).toBeNull();
    const match = hospital(7, trip.destinos[0].hospital, trip.destinos[0].ciudad!);
    expect(aplicarEjemplo(trip, [branch(1, 'CDMX')], [match], ids).person.destinations[0].hospitalId).toBe(7);
    expect(aplicarEjemplo(trip, [branch(1, 'CDMX')], [match, { ...match, codigoContacto: 8 }], ids).person.destinations[0].hospitalId).toBeNull();
  });

  it('preserves selected origin and leaves terminal departure separate from origin departure', () => {
    const result = aplicarEjemplo(VIAJES_EJEMPLO[1], [branch(1, 'CDMX'), branch(2, 'CDMX')], [], { ...ids, originId: 2 });
    expect(result.person.originId).toBe(2);
    expect(result.person.departureDate).toBe('');
    expect(result.person.departureTime).toBe('');
    expect(result.person.destinations[0].date).toBe('2026-10-06');
    expect(aplicarEjemplo(VIAJES_EJEMPLO[0], [branch(1, 'CDMX'), branch(2, 'CDMX')], [], ids).origenId).toBeNull();
    expect(aplicarEjemplo(VIAJES_EJEMPLO[0], [branch(1, 'Estado de México')], [], ids).origenId).toBeNull();
  });
});
