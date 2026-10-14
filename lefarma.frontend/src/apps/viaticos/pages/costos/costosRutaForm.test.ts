import { describe, expect, it } from 'vitest';
import type { Sucursal } from '@/types/catalogo.types';
import type { HospitalUbicacion } from '@/apps/educacion-medica/types/educacionMedica.types';
import { buildRouteRequest, localTomorrow, newPerson } from './costosRutaForm';

const options = { respetarHorarioLaboral: true, calcularHoteles: true, calcularViajesIntermedios: true, compartirViaje: false };
const branch = (id: number, name = `Branch ${id}`, ciudad = 'CDMX'): Sucursal => ({
  idSucursal: id, idEmpresa: 1, nombre: name, ciudad, latitud: 19, longitud: -99,
  numeroEmpleados: 0, activo: true, fechaCreacion: '2026-01-01',
});
const hospital = (codigo: number, nombre: string, ciudad: string | null): HospitalUbicacion => ({
  codigoContacto: codigo, nombreContacto: nombre, nombreCorto: null, clues: null, ciudad,
  codigoEstado: null, latitud: 20, longitud: -100, idRegion: null, regionNombre: null,
});
const branches = [branch(1), branch(2)];
const hospitals = [hospital(1, 'Hospital Uno', 'Puebla'), hospital(2, 'Hospital Dos', 'León')];
function validPerson() {
  return { ...newPerson(1), name: 'Ana', originId: 1, destinations: [{ id: 1, hospitalId: 2, date: '2026-10-15' }] };
}

describe('local calendar defaults', () => {
  it.each([
    [new Date(2026, 9, 31, 23, 59), '2026-11-01'],
    [new Date(2026, 11, 31, 23, 59), '2027-01-01'],
    [new Date(2028, 1, 28, 23, 59), '2028-02-29'],
    [new Date('2026-12-31T23:30:00-06:00'), '2027-01-01'],
  ])('defaults tomorrow from local date %s', (now, expected) => {
    expect(localTomorrow(now)).toBe(expected);
  });
});

describe('typed route request', () => {
  it('uses a full default day and leaves derived origin departure unspecified', () => {
    const { request, errors } = buildRouteRequest([validPerson()], branches, hospitals, options);
    expect(errors).toEqual([]);
    expect(request?.personas[0].lugares[0]).not.toHaveProperty('fecha_salida');
    expect(request?.personas[0].lugares[0]).toMatchObject({ orden: 1, tipo: 'salida', nombre: 'Branch 1' });
    expect(request?.personas[0].lugares[1]).toMatchObject({
      orden: 2, tipo: 'taller', nombre: 'Hospital Dos',
      fecha_inicio_actividad: '2026-10-15', hora_inicio_actividad: '08:00',
      fecha_fin_actividad: '2026-10-15', hora_fin_actividad: '18:30',
    });
    expect(request?.personas[0].draft).toBe(false);
  });

  it('resolves the origin from the branch catalog and the destination from the hospital catalog independently', () => {
    const person = { ...newPerson(1), name: 'Ana', originId: 1, destinations: [{ id: 1, hospitalId: 1, date: '2026-10-15' }] };
    const { request } = buildRouteRequest([person], branches, hospitals, options);
    // Same numeric id (1) exists in both catalogs with different names and coordinates.
    expect(request?.personas[0].lugares.map(place => [place.orden, place.tipo, place.nombre, place.latitud])).toEqual([
      [1, 'salida', 'Branch 1', 19],
      [2, 'taller', 'Hospital Uno', 20],
    ]);
  });

  it('uses custom hours, explicit departure, car/fuel/options without changing dates', () => {
    const person = { ...validPerson(), start: '07:15', end: '19:45', ownCar: true, fuel: 'premium' as const,
      departureDate: '2026-10-14', departureTime: '23:15' };
    const changed = { respetarHorarioLaboral: false, calcularHoteles: false, calcularViajesIntermedios: false, compartirViaje: true };
    const { request } = buildRouteRequest([person], branches, hospitals, changed);
    expect(request?.opciones).toEqual(changed);
    expect(request?.personas[0]).toMatchObject({ carro_propio: true, gasolina: 'premium',
      trabajo: { hora_entrada: '07:15', hora_salida: '19:45' } });
    expect(request?.personas[0].lugares[0]).toMatchObject({ fecha_salida: '2026-10-14', hora_salida: '23:15' });
    expect(request?.personas[0].lugares[1]).toMatchObject({ hora_inicio_actividad: '07:15', hora_fin_actividad: '19:45' });
  });

  it.each([
    { latitud: null }, { longitud: null }, { latitud: Number.NaN }, { longitud: Infinity },
    { latitud: 91 }, { longitud: -181 }, { latitud: 0, longitud: 0 }, { latitud: '20.5' },
  ])('blocks invalid destination hospital coordinates without coercion: %j', invalid => {
    const bad = { ...hospital(2, 'Hospital Dos', 'León'), ...invalid } as HospitalUbicacion;
    const result = buildRouteRequest([validPerson()], branches, [hospital(1, 'Hospital Uno', 'Puebla'), bad], options);
    expect(result.request).toBeNull();
    expect(result.errors.join()).toContain('«Hospital Dos» no tiene coordenadas válidas');
  });

  it('identifies an invalid origin and blocks inactive or missing selections', () => {
    const result = buildRouteRequest([validPerson()], [{ ...branch(1), latitud: 0, longitud: 0 }, branch(2)], hospitals, options);
    expect(result.errors.join()).toContain('origen: «Branch 1»');
    expect(result.request).toBeNull();
    expect(buildRouteRequest([{ ...validPerson(), originId: 2 }], [branch(1), { ...branch(2), activo: false }], hospitals, options).request).toBeNull();
    const missingHospital = { ...validPerson(), destinations: [{ id: 1, hospitalId: null, date: '2026-10-15' }] };
    expect(buildRouteRequest([missingHospital], branches, hospitals, options).errors.join()).toContain('selecciona un hospital');
    expect(buildRouteRequest([newPerson(1)], branches, hospitals, options).request).toBeNull();
  });

  it.each(['2026-10-15', '2026-10-14'])('blocks overlapping or inverted full-day stops (%s)', date => {
    const person = validPerson();
    person.destinations.push({ id: 2, hospitalId: 1, date });
    const result = buildRouteRequest([person], branches, hospitals, options);
    expect(result.request).toBeNull();
    expect(result.errors.join()).toContain('superponen o están en orden inverso');
    expect(person.destinations[1].date).toBe(date);
  });

  it('rejects inverted hours, invalid dates and partial departure', () => {
    expect(buildRouteRequest([{ ...validPerson(), start: '19:00', end: '08:00' }], branches, hospitals, options).request).toBeNull();
    expect(buildRouteRequest([{ ...validPerson(), departureDate: '2026-10-14' }], branches, hospitals, options).request).toBeNull();
    const person = validPerson();
    person.destinations[0].date = '2026-02-30';
    expect(buildRouteRequest([person], branches, hospitals, options).request).toBeNull();
  });

  it('preserves Friday 16:57 departure for backend feasibility, without moving attendance', () => {
    const person = { ...validPerson(), departureDate: '2026-10-02', departureTime: '16:57',
      destinations: [{ id: 1, hospitalId: 2, date: '2026-10-02' }] };
    const { request, errors } = buildRouteRequest([person], branches, hospitals, options);
    expect(errors).toEqual([]);
    expect(request?.personas[0].lugares[0]).toMatchObject({ fecha_salida: '2026-10-02', hora_salida: '16:57' });
    expect(request?.personas[0].lugares[1]).toMatchObject({ fecha_inicio_actividad: '2026-10-02', hora_inicio_actividad: '08:00' });
  });

  it('allows chronological same-day appointment overrides without inferring duration', () => {
    const person = { ...validPerson(), destinations: [
      { id: 1, hospitalId: 1, date: '2026-10-15', start: '09:00', end: '10:00' },
      { id: 2, hospitalId: 2, date: '2026-10-15', start: '11:00', end: '12:30' },
    ] };
    const { request, errors } = buildRouteRequest([person], branches, hospitals, options);
    expect(errors).toEqual([]);
    expect(request?.personas[0].lugares.slice(1).map(l => [l.hora_inicio_actividad, l.hora_fin_actividad]))
      .toEqual([['09:00', '10:00'], ['11:00', '12:30']]);
    expect(buildRouteRequest([{ ...person, destinations: [{ ...person.destinations[0], end: '08:00' }] }], branches, hospitals, options).request).toBeNull();
  });

  it('rejects duplicate names because backend proposal identity is name-based', () => {
    expect(buildRouteRequest([validPerson(), { ...validPerson(), id: 2, name: ' ana ' }], branches, hospitals, options).request).toBeNull();
  });

  it('explains non-working days unless the existing schedule option is disabled', () => {
    const person = validPerson();
    person.destinations[0].date = '2026-10-17';
    expect(buildRouteRequest([person], branches, hospitals, options).errors.join()).toContain('no es un día laboral');
    expect(buildRouteRequest([person], branches, hospitals, { ...options, respetarHorarioLaboral: false }).request).not.toBeNull();
  });

  it('enforces person bounds and missing destinations', () => {
    expect(buildRouteRequest([], branches, hospitals, options).request).toBeNull();
    expect(buildRouteRequest(Array.from({ length: 10 }, validPerson), branches, hospitals, options).request).toBeNull();
    expect(buildRouteRequest([{ ...validPerson(), destinations: [] }], branches, hospitals, options).request).toBeNull();
  });
});

describe('manual map points and arrival', () => {
  const punto = (nombre: string, latitud = 19.5, longitud = -99.5) => ({ nombre, latitud, longitud });

  it('uses a manual origin point instead of the branch catalog, even without a branch', () => {
    const person = { ...validPerson(), originId: null, origenPunto: punto('Casa del empleado', 19.3, -99.2) };
    const { request, errors } = buildRouteRequest([person], branches, hospitals, options);
    expect(errors).toEqual([]);
    expect(request?.personas[0].lugares[0]).toMatchObject({ orden: 1, tipo: 'salida', nombre: 'Casa del empleado', latitud: 19.3, longitud: -99.2 });
  });

  it('a manual destination point overrides the selected hospital', () => {
    const person = { ...validPerson(), destinations: [{ id: 1, hospitalId: 2, date: '2026-10-15', punto: punto('Clínica privada', 20.1, -100.1) }] };
    const { request, errors } = buildRouteRequest([person], branches, hospitals, options);
    expect(errors).toEqual([]);
    expect(request?.personas[0].lugares[1]).toMatchObject({
      orden: 2, tipo: 'taller', nombre: 'Clínica privada', latitud: 20.1, longitud: -100.1,
      fecha_inicio_actividad: '2026-10-15', hora_inicio_actividad: '08:00', hora_fin_actividad: '18:30',
    });
  });

  it.each([
    { latitud: Number.NaN, longitud: -99 },
    { latitud: 19, longitud: Infinity },
    { latitud: 91, longitud: -99 },
    { latitud: 19, longitud: -181 },
    { latitud: 0, longitud: 0 },
  ])('blocks an invalid manual origin point without coercion: %j', invalid => {
    const person = { ...validPerson(), originId: null, origenPunto: { nombre: 'Punto raro', ...invalid } };
    const result = buildRouteRequest([person], branches, hospitals, options);
    expect(result.request).toBeNull();
    expect(result.errors.join()).toContain('«Punto raro» no tiene coordenadas válidas');
  });

  it('blocks a manual point without a name', () => {
    const person = { ...validPerson(), originId: null, origenPunto: { nombre: '   ', latitud: 19, longitud: -99 } };
    expect(buildRouteRequest([person], branches, hospitals, options).errors.join()).toContain('necesita un nombre');
  });

  it('emits arrival only when both date and time are provided', () => {
    const person = validPerson();
    const destino = person.destinations[0];
    const both = buildRouteRequest([{ ...person, destinations: [{ ...destino, llegadaFecha: '2026-10-15', llegadaHora: '09:30' }] }], branches, hospitals, options);
    expect(both.errors).toEqual([]);
    expect(both.request?.personas[0].lugares[1]).toMatchObject({ fecha_llegada: '2026-10-15', hora_llegada: '09:30' });
    const none = buildRouteRequest([person], branches, hospitals, options);
    expect(none.request?.personas[0].lugares[1]).not.toHaveProperty('fecha_llegada');
    const soloFecha = buildRouteRequest([{ ...person, destinations: [{ ...destino, llegadaFecha: '2026-10-15' }] }], branches, hospitals, options);
    expect(soloFecha.request).toBeNull();
    expect(soloFecha.errors.join()).toContain('fecha y hora de llegada');
    const soloHora = buildRouteRequest([{ ...person, destinations: [{ ...destino, llegadaHora: '09:30' }] }], branches, hospitals, options);
    expect(soloHora.request).toBeNull();
    expect(soloHora.errors.join()).toContain('fecha y hora de llegada');
  });
});
