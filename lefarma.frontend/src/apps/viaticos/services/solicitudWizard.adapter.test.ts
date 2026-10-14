import { describe, expect, it } from 'vitest';
import type { Sucursal } from '@/types/catalogo.types';
import {
  adaptarTramoACostosRuta,
  esOfertaVuelo,
  hayMonedaMezclada,
  MONEDA_PERMITIDA,
  rangoDelViaje,
} from './solicitudWizard.adapter';
import type { DestinoV2, OrigenV2 } from '../types/wizardV2.types';

const sucursal = (id: number, nombre: string): Sucursal => ({
  idSucursal: id,
  idEmpresa: 1,
  nombre,
  ciudad: 'Ciudad de México',
  latitud: 19.43,
  longitud: -99.13,
  activo: true,
  numeroEmpleados: 0,
  fechaCreacion: '2026-01-01',
});

const origen: OrigenV2 = {
  tipo: 'sucursal',
  sucursalId: 1,
  punto: null,
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
      sucursales: [sucursal(1, 'Matriz')],
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

  it('marca carro_propio falso en modo transporte solicitado', () => {
    const { request, errors } = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen,
      destino: destino(),
      sucursales: [sucursal(1, 'Matriz')],
    });
    expect(errors).toEqual([]);
    expect(request!.personas[0].carro_propio).toBe(false);
    expect(request!.personas[0].gasolina).toBe('magna');
  });

  it('reporta error sin coordenadas válidas en vez de inventarlas', () => {
    const { request, errors } = adaptarTramoACostosRuta({
      nombreViajero: 'Persona Viajera',
      modoTransporte: 'solicitado',
      origen: { ...origen, sucursalId: 99 },
      destino: destino(),
      sucursales: [sucursal(1, 'Matriz')],
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
      sucursales: [sucursal(1, 'Matriz')],
    });
    const conHotel = adaptarTramoACostosRuta({
      nombreViajero: 'V',
      modoTransporte: 'solicitado',
      origen,
      destino: destino({
        hospedaje: { necesario: true, zona: 'actual', fechaEntrada: '2026-11-10', fechaSalida: '2026-11-11', hotel: null },
      }),
      sucursales: [sucursal(1, 'Matriz')],
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
        saleFecha: '2026-11-13',
        saleHora: '08:00',
        llegadaRequeridaFecha: '2026-11-13',
        llegadaRequeridaHora: '14:00',
      }),
    ).toEqual({ inicio: '2026-11-10', fin: '2026-11-13' });
  });

  it('sin retorno usa la última salida de destino', () => {
    expect(
      rangoDelViaje(origen, [destino()], {
        necesario: false,
        saleFecha: '',
        saleHora: '',
        llegadaRequeridaFecha: '',
        llegadaRequeridaHora: '',
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
