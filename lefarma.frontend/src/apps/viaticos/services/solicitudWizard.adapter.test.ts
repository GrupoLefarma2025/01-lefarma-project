import { describe, expect, it } from 'vitest';
import {
  adaptarTramoACostosRuta,
  esOfertaVuelo,
  hayMonedaMezclada,
  MONEDA_PERMITIDA,
  rangoDelViaje,
} from './solicitudWizard.adapter';
import type { DestinoV2, OrigenV2 } from '../types/wizardV2.types';

const origen: OrigenV2 = {
  punto: { nombre: 'Origen', latitud: 19.43, longitud: -99.13 },
  fechaSalida: '2026-11-10',
  horaSalida: '06:00',
};

const destino = (ajustes: Partial<DestinoV2> = {}): DestinoV2 => ({
  id: 'd1',
  punto: { nombre: 'Punto destino', latitud: 20.67, longitud: -103.34 },
  debeEstarFecha: '2026-11-10',
  debeEstarHora: '12:00',
  saleFecha: '2026-11-10',
  saleHora: '18:00',
  hospedaje: { necesario: false, zona: 'actual', fechaEntrada: '', fechaSalida: '', hotel: null },
  cotizacion: null,
  ...ajustes,
});

describe('adaptarTramoACostosRuta (frontera con el algoritmo legacy)', () => {
  it('construye una solicitud legacy válida para un tramo con Magna fija', () => {
    const { request, errors } = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'propio',
      origen,
      destino: destino(),
    });
    expect(errors).toEqual([]);
    expect(request).not.toBeNull();
    expect(request!.personas).toHaveLength(1);
    expect(request!.personas[0].carro_propio).toBe(true);
    // Carro propio SIEMPRE usa Magna: no hay elección premium en el wizard nuevo.
    expect(request!.personas[0].gasolina).toBe('magna');
    expect(request!.personas[0].lugares.map((l) => l.tipo)).toEqual(['salida', 'taller']);
    expect(request!.personas[0].lugares[0].fecha_salida).toBe('2026-11-10');
  });

  it('usa la jornada 07:00-18:30 por defecto y respeta la configurada', () => {
    const porDefecto = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen,
      destino: destino(),
    });
    expect(porDefecto.request!.personas[0].trabajo.hora_entrada).toBe('07:00');
    expect(porDefecto.request!.personas[0].trabajo.hora_salida).toBe('18:30');
    const configurada = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen,
      destino: destino(),
      jornada: { horaEntrada: '08:00', horaSalida: '17:00' },
    });
    expect(configurada.request!.personas[0].trabajo.hora_entrada).toBe('08:00');
    expect(configurada.request!.personas[0].trabajo.hora_salida).toBe('17:00');
  });

  it('marca carro_propio falso en modo transporte solicitado', () => {
    const { request, errors } = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen,
      destino: destino(),
    });
    expect(errors).toEqual([]);
    expect(request!.personas[0].carro_propio).toBe(false);
    expect(request!.personas[0].gasolina).toBe('magna');
  });

  it('omite la salida del origen cuando no se captura (el motor la calcula)', () => {
    const { request, errors } = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen: { ...origen, fechaSalida: '', horaSalida: '' },
      destino: destino(),
    });
    expect(errors).toEqual([]);
    expect(request).not.toBeNull();
    expect(request!.personas[0].lugares[0].fecha_salida).toBeUndefined();
    expect(request!.personas[0].lugares[0].hora_salida).toBeUndefined();
  });

  it('rechaza una salida del origen incompleta (fecha sin hora o al revés)', () => {
    const soloFecha = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen: { ...origen, horaSalida: '' },
      destino: destino(),
    });
    expect(soloFecha.request).toBeNull();
    expect(soloFecha.errors.join(' ')).toContain('fecha Y hora');
    const soloHora = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen: { ...origen, fechaSalida: '' },
      destino: destino(),
    });
    expect(soloHora.request).toBeNull();
  });

  it('reporta error sin coordenadas válidas en vez de inventarlas', () => {
    const { request, errors } = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen: { ...origen, punto: { nombre: 'Sin coordenadas', latitud: 0, longitud: 0 } },
      destino: destino(),
    });
    expect(request).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('pide hospedaje al motor solo cuando el destino lo marca necesario', () => {
    const sinHotel = adaptarTramoACostosRuta({
      nombreViajero: 'V',
      modoTransporte: 'solicitado',
      origen,
      destino: destino(),
    });
    const conHotel = adaptarTramoACostosRuta({
      nombreViajero: 'V',
      modoTransporte: 'solicitado',
      origen,
      destino: destino({
        hospedaje: { necesario: true, zona: 'actual', fechaEntrada: '2026-11-10', fechaSalida: '2026-11-11', hotel: null },
      }),
    });
    expect(sinHotel.request!.opciones.calcularHoteles).toBe(false);
    expect(conHotel.request!.opciones.calcularHoteles).toBe(true);
  });
});

describe('rangoDelViaje (derivado de la cronología, no capturado)', () => {
  it('deriva inicio y fin desde origen, destinos y retorno', () => {
    expect(
      rangoDelViaje(origen, [destino(), destino({ id: 'd2', debeEstarFecha: '2026-11-12', saleFecha: '2026-11-12' })], {
        necesario: true,
        llegadaRequeridaFecha: '2026-11-13',
        llegadaRequeridaHora: '14:00',
        destino: 'origen',
        punto: null,
      }),
    ).toEqual({ inicio: '2026-11-10', fin: '2026-11-13' });
  });

  it('sin retorno usa la última salida de destino', () => {
    expect(
      rangoDelViaje(origen, [destino()], {
        necesario: false,
        llegadaRequeridaFecha: '',
        llegadaRequeridaHora: '',
        destino: 'origen',
        punto: null,
      }),
    ).toEqual({ inicio: '2026-11-10', fin: '2026-11-10' });
  });
});

describe('reglas de moneda y modo', () => {
  it('la moneda permitida del prototipo es MXN', () => {
    expect(MONEDA_PERMITIDA).toBe('MXN');
  });

  it('detecta mezcla de monedas sin sumarlas', () => {
    expect(hayMonedaMezclada([{ moneda: 'MXN' }, { moneda: 'MXN' }])).toBe(false);
    expect(hayMonedaMezclada([{ moneda: 'MXN' }, { moneda: 'USD' }])).toBe(true);
  });

  it('solo modo avion pide equipaje', () => {
    expect(esOfertaVuelo({ modo: 'avion' })).toBe(true);
    expect(esOfertaVuelo({ modo: 'autobus' })).toBe(false);
    expect(esOfertaVuelo({ modo: 'auto' })).toBe(false);
  });
});
