import { describe, expect, it } from 'vitest';
import { resolverTipoSolicitudIncidencia } from '@/apps/rh/utils/incidencias';
import type {
  IncidenciaCalculada,
  IncidenciaChecadoResponse,
  TipoSolicitudResponse,
} from '@/types/solicitudPersonal.types';

function tipo(
  idTipoSolicitud: number,
  clave: string,
  nombre: string,
  categoria: string
): TipoSolicitudResponse {
  return {
    idTipoSolicitud,
    clave,
    nombre,
    categoria,
    descripcion: '',
    esIncidencia: categoria === '1',
    esPermiso: categoria === '2',
    esIncapacidad: false,
    requiereReposicionTiempo: false,
    requiereFechaFin: false,
    requiereFechaRegreso: false,
    requiereLugarComision: false,
    descuentaNomina: false,
    descuentaVacaciones: false,
    requiereDocumentacion: false,
    permiteFechasPasadas: true,
    permiteFechasFuturas: false,
    tomaEnCuentaChecado: categoria === '1',
    requiereIncidenciasExistentes: false,
    pideDiasSolicitados: false,
    requiereValidacionRH: false,
    requiereValidacionJefeDirecto: true,
    requiereValidacionGerencia: false,
    requiereValidacionDirector: false,
    activo: true,
    fechaCreacion: '2026-01-01T00:00:00',
  };
}

// Mismo catálogo de rh.tipo_solicitud en Dev y Productivo.
const CATALOGO: TipoSolicitudResponse[] = [
  tipo(2, 'OMISION_CHECADO_SALIDA', 'Omisión de checado salida', '1'),
  tipo(3, 'RETARDO_MENOR_20', 'Retardo menor a 20 minutos', '1'),
  tipo(4, 'RETARDO_MAYOR_20', 'Retardo mayor a 20 minutos', '1'),
  tipo(31, 'OMISION_CHECADO_ENTRADA', 'Omisión de checado entrada', '1'),
  tipo(7, 'SALIDA_TEMPRANA_SIN_REPOSICION', 'Salida temprana sin reposición', '2'),
  tipo(8, 'SALIDA_TEMPRANA_CON_REPOSICION', 'Salida temprana con reposición', '2'),
];

function calculada(tipoIncidencia: string, nombre = tipoIncidencia): IncidenciaCalculada {
  return { tipoIncidencia, nombre, generaDescuento: false };
}

function incidencia(
  overrides: Partial<IncidenciaChecadoResponse> = {}
): IncidenciaChecadoResponse {
  return {
    fecha: '2026-10-27',
    nomina: 1234567,
    entrada: '08:00:00',
    salida: '18:30:00',
    incidenciasCalculadas: [],
    ...overrides,
  };
}

describe('resolverTipoSolicitudIncidencia', () => {
  it('precarga retardo menor a 20 minutos', () => {
    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: '08:10:00',
        incidenciasCalculadas: [
          calculada('TARDANZA_ENTRADA', 'Retardo de entrada igual o menor a 20 min'),
        ],
      }),
      CATALOGO
    );

    expect(resultado).toEqual({
      categoria: '1',
      idTipoSolicitud: 3,
      clave: 'RETARDO_MENOR_20',
    });
  });

  it('precarga retardo mayor a 20 minutos', () => {
    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: '08:25:00',
        incidenciasCalculadas: [
          calculada('TARDANZA_ENTRADA', 'Retardo de entrada mayor a 20 min'),
        ],
      }),
      CATALOGO
    );

    expect(resultado).toEqual({
      categoria: '1',
      idTipoSolicitud: 4,
      clave: 'RETARDO_MAYOR_20',
    });
  });

  it('usa el nombre de la regla si no hay horas para calcular el retardo', () => {
    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: null,
        incidenciasCalculadas: [
          calculada('TARDANZA_ENTRADA', 'Retardo de entrada mayor a 20 min'),
        ],
      }),
      CATALOGO
    );

    expect(resultado?.idTipoSolicitud).toBe(4);
  });

  it('precarga omisión de entrada', () => {
    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: null,
        incidenciasCalculadas: [calculada('OMISION_ENTRADA', 'Omisión de entrada')],
      }),
      CATALOGO
    );

    expect(resultado?.idTipoSolicitud).toBe(31);
  });

  it('precarga omisión de salida', () => {
    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        salio: null,
        incidenciasCalculadas: [calculada('OMISION_SALIDA', 'Omisión de salida')],
      }),
      CATALOGO
    );

    expect(resultado?.idTipoSolicitud).toBe(2);
  });

  it('precarga salida temprana sin reposición en la categoría Permiso', () => {
    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        salio: '17:30:00',
        incidenciasCalculadas: [calculada('SALIDA_ANTICIPADA', 'Salida anticipada')],
      }),
      CATALOGO
    );

    expect(resultado).toEqual({
      categoria: '2',
      idTipoSolicitud: 7,
      clave: 'SALIDA_TEMPRANA_SIN_REPOSICION',
    });
  });

  it('con varias incidencias usa la de mayor prioridad configurada', () => {
    const omisiones = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: null,
        salio: null,
        incidenciasCalculadas: [
          calculada('OMISION_ENTRADA', 'Omisión de entrada'),
          calculada('OMISION_SALIDA', 'Omisión de salida'),
        ],
      }),
      CATALOGO
    );

    expect(omisiones?.idTipoSolicitud).toBe(2);

    const retardoYSalida = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: '08:30:00',
        salio: '17:30:00',
        incidenciasCalculadas: [
          calculada('TARDANZA_ENTRADA', 'Retardo de entrada mayor a 20 min'),
          calculada('SALIDA_ANTICIPADA', 'Salida anticipada'),
        ],
      }),
      CATALOGO
    );

    expect(retardoYSalida?.idTipoSolicitud).toBe(7);
  });

  it('usa las columnas legacy cuando no hay incidencias calculadas', () => {
    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: '08:30:00',
        incidenciaEntrada: 'Retardo',
      }),
      CATALOGO
    );

    expect(resultado?.idTipoSolicitud).toBe(4);
  });

  it('resuelve por nombre si la clave del catálogo cambió', () => {
    const catalogoRenombrado = [
      tipo(99, 'CLAVE_NUEVA', 'Retardo mayor a 20 minutos', '1'),
    ];

    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: '08:30:00',
        incidenciasCalculadas: [calculada('TARDANZA_ENTRADA')],
      }),
      catalogoRenombrado
    );

    expect(resultado?.idTipoSolicitud).toBe(99);
  });

  it('devuelve null cuando no hay tipo equivalente en el catálogo', () => {
    const resultado = resolverTipoSolicitudIncidencia(
      incidencia({
        entro: '08:10:00',
        incidenciasCalculadas: [calculada('TARDANZA_ENTRADA')],
      }),
      [tipo(50, 'OTRO', 'Otro tipo', '1')]
    );

    expect(resultado).toBeNull();
  });
});
