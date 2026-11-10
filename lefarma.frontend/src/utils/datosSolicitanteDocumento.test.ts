import { describe, expect, it } from 'vitest';
import { areaDocumento, datosSolicitanteDocumento } from './datosSolicitanteDocumento';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';

/** Orden mínima: solo importan los campos del solicitante y el área del catálogo. */
function orden(overrides: Partial<OrdenCompraResponse> = {}): OrdenCompraResponse {
  return {
    idOrden: 1,
    idArea: 11,
    areaNombre: 'Auxiliar de pagos',
    solicitanteNombre: 'Brandom Rafael Ledezma Muñoz',
    solicitanteCorreo: '6@grupolefarma.com.mx',
    solicitantePuesto: 'COORDINADOR DE DESARROLLO',
    solicitanteArea: 'TI',
    ...overrides,
  } as OrdenCompraResponse;
}

describe('areaDocumento', () => {
  it('usa el área del empleado (vwEmpleados) en lugar del catálogo de CxP', () => {
    expect(areaDocumento(orden())).toBe('TI');
  });

  it('cae al catálogo solo cuando el empleado no tiene área', () => {
    expect(areaDocumento(orden({ solicitanteArea: null }))).toBe('Auxiliar de pagos');
  });

  it('usa un último recurso cuando no hay ninguna área', () => {
    expect(areaDocumento(orden({ solicitanteArea: null, areaNombre: null }))).toBe('Área 11');
  });

  it('para creadores @grupolefarma prefiere el área del jefe que se imprime', () => {
    const conJefe = orden({
      segundoAutorizador: 'Daniel Gasca Hinojosa',
      segundoAutorizadorArea: 'CALIDAD',
      segundoAutorizadorPuesto: 'GERENTE CORPORATIVO DE CALIDAD',
    });

    expect(datosSolicitanteDocumento(conJefe).area).toBe('CALIDAD');
    expect(areaDocumento(conJefe)).toBe('CALIDAD');
  });
});
