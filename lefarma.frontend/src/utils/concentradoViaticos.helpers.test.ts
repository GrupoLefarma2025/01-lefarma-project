import { describe, expect, it } from 'vitest';
import type { MacroViatico } from '@/types/macroViatico.types';
import {
  buildHeader,
  claveGrupoViatico,
  fechaViajeLineas,
  fmtFecha,
  fmtFechaLarga,
  fmtMesCorto,
  fmtMoneyCelda,
  ordenarViaticos,
  parseFechaLocal,
  sumarCostos,
  texto,
  totalViatico,
  unicoOVarias,
} from './concentradoViaticos.helpers';

function fila(overrides: Partial<MacroViatico> = {}): MacroViatico {
  return {
    folio: 'VIA-0001',
    nombre: 'DANIEL PADILLA',
    gerencia: 'EDUCACION MEDICA',
    fecha: '2026-06-01',
    renglon: 1,
    solicitante: 'JUAN PABLO PEÑA PORTILLO',
    fechInicio: '2026-06-03',
    fechaFin: '2026-06-04',
    origen: 'CDMX',
    destino: 'TEPIC PUERTO VALLARTA',
    costoAutobus: 650,
    costoAvion: 11541,
    costoGasolina: null,
    costoCasetas: null,
    costoHospedaje: 1392,
    costoComida: 900,
    costoTaxi: 2640,
    diasHospedaje: 2,
    numeroComidas: 3,
    ...overrides,
  };
}

describe('concentradoViaticos.helpers', () => {
  it('suma los siete costos y trata los nulos como cero', () => {
    expect(totalViatico(fila())).toBe(17123);
    expect(totalViatico(fila({ costoAutobus: null, costoTaxi: null }))).toBe(13833);
  });

  it('acumula los costos de varias filas y calcula el total general', () => {
    const totales = sumarCostos([
      fila(),
      fila({
        folio: 'VIA-0002',
        renglon: 2,
        costoAutobus: null,
        costoAvion: null,
        costoGasolina: 500,
        costoCasetas: 120,
        costoHospedaje: null,
        costoComida: null,
        costoTaxi: null,
      }),
    ]);

    expect(totales).toEqual({
      costoAutobus: 650,
      costoAvion: 11541,
      costoGasolina: 500,
      costoCasetas: 120,
      costoHospedaje: 1392,
      costoComida: 900,
      costoTaxi: 2640,
      total: 17743,
    });
  });

  it('interpreta las fechas ISO como locales, sin desfase UTC', () => {
    const fecha = parseFechaLocal('2026-06-01T00:00:00') as Date;
    expect(fecha.getFullYear()).toBe(2026);
    expect(fecha.getMonth()).toBe(5);
    expect(fecha.getDate()).toBe(1);
    expect(fmtFecha(fecha)).toBe('01/06/2026');
  });

  it('formatea el mes corto del encabezado', () => {
    expect(fmtMesCorto('2026-06-01')).toBe('jun-26');
    expect(fmtMesCorto('2026-12-31T23:00:00')).toBe('dic-26');
    expect(fmtMesCorto(null)).toBe('—');
  });

  it('formatea la fecha larga en español', () => {
    expect(fmtFechaLarga('2026-06-01')).toBe('1 de junio del 2026');
    expect(fmtFechaLarga('2026-07-26')).toBe('26 de julio del 2026');
    expect(fmtFechaLarga(null)).toBe('—');
  });

  it('arma una o dos líneas de fecha de viaje', () => {
    expect(fechaViajeLineas('2026-06-03', '2026-06-04')).toEqual([
      '03/06/2026',
      'AL 04/06/2026',
    ]);
    expect(fechaViajeLineas('2026-06-03', '2026-06-03')).toEqual(['03/06/2026']);
    expect(fechaViajeLineas(null, null)).toEqual(['—']);
    expect(fechaViajeLineas(null, '2026-06-04')).toEqual(['04/06/2026']);
  });

  it('usa un valor único o VARIAS en el encabezado', () => {
    expect(unicoOVarias([])).toBe('—');
    expect(unicoOVarias([null, '  '])).toBe('—');
    expect(unicoOVarias(['DANIEL PADILLA'])).toBe('DANIEL PADILLA');
    expect(unicoOVarias([' DANIEL PADILLA ', 'DANIEL PADILLA'])).toBe('DANIEL PADILLA');
    expect(unicoOVarias(['DANIEL PADILLA', 'SANTIAGO GARCIA'])).toBe('VARIAS');
  });

  it('arma el encabezado con la misma fecha cuando todas las filas coinciden', () => {
    const header = buildHeader([
      fila(),
      fila({ folio: 'VIA-0002', renglon: 2, fecha: '2026-06-01' }),
    ]);

    expect(header).toEqual({
      nombre: 'DANIEL PADILLA',
      gerencia: 'EDUCACION MEDICA',
      fecha: '1 de junio del 2026',
    });
  });

  it('marca VARIAS cuando cambia el nombre, la gerencia o la fecha', () => {
    const header = buildHeader([
      fila(),
      fila({
        folio: 'VIA-0002',
        renglon: 2,
        nombre: 'SANTIAGO GARCIA',
        gerencia: 'OPERACIONES',
        fecha: '2026-07-01',
      }),
    ]);

    expect(header).toEqual({
      nombre: 'VARIAS',
      gerencia: 'VARIAS',
      fecha: 'VARIAS',
    });
  });

  it('agrupa por nombre y gerencia sin distinguir mayúsculas ni espacios', () => {
    const a = fila({ nombre: ' DANIEL PADILLA ', gerencia: 'EDUCACION MEDICA' });
    const b = fila({
      folio: 'VIA-0002',
      nombre: 'daniel padilla',
      gerencia: ' educacion medica ',
    });

    expect(claveGrupoViatico(a)).toBe(claveGrupoViatico(b));
  });

  it('separa solicitante, gerencia o fecha distintos', () => {
    const base = claveGrupoViatico(fila());

    expect(claveGrupoViatico(fila({ nombre: 'SANTIAGO GARCIA' }))).not.toBe(base);
    expect(claveGrupoViatico(fila({ gerencia: 'OPERACIONES' }))).not.toBe(base);
    expect(claveGrupoViatico(fila({ fecha: '2026-06-20' }))).not.toBe(base);
  });

  it('ordena por grupo, renglón y folio', () => {
    const ordenadas = ordenarViaticos(
      [
        fila({ folio: 'B-2', nombre: 'B', renglon: 2 }),
        fila({ folio: 'A-2', nombre: 'A', renglon: 2 }),
        fila({ folio: 'A-1', nombre: 'A', renglon: 1 }),
      ],
      'nombre',
    );

    expect(ordenadas.map((f) => f.folio)).toEqual(['A-1', 'A-2', 'B-2']);
  });

  it('imprime $ - en costos nulos o en cero y el monto en el resto', () => {
    expect(fmtMoneyCelda(null)).toBe('$ -');
    expect(fmtMoneyCelda(0)).toBe('$ -');
    expect(fmtMoneyCelda(1234.5)).toBe('$1,234.50');
  });

  it('normaliza textos vacíos a —', () => {
    expect(texto(null)).toBe('—');
    expect(texto('  ')).toBe('—');
    expect(texto('  CDMX  ')).toBe('CDMX');
  });
});
