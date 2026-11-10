import { describe, expect, it } from 'vitest';
import type { EmpleadoJefesConfigResponse } from '@/types/jefesNiveles.types';
import type { WorkflowPasoFlowResponse } from '@/types/solicitudPersonalWorkflow.types';
import { pasoSeOmitira, responsablesJefePaso } from './flujoJefes';

function pasoJefe(nivel: number): WorkflowPasoFlowResponse {
  return {
    idPaso: nivel * 10,
    orden: nivel * 10,
    nombrePaso: 'Aprobación Jefe Inmediato',
    esInicio: false,
    esFinal: false,
    activo: true,
    requiereFirma: false,
    requiereComentario: false,
    requiereAdjunto: false,
    permiteAdjunto: false,
    participantes: [
      {
        requiereJefeInmediato: true,
        nivelJefe: nivel,
      },
    ],
  };
}

function config(
  niveles: Array<{
    nivel: number;
    aplica: boolean;
    idUsuarioJefeVista?: number | null;
    idUsuarioJefeOverride?: number | null;
    nombreJefeVista?: string | null;
    nombreJefeOverride?: string | null;
  }>
): EmpleadoJefesConfigResponse {
  return {
    idUsuario: 137,
    esConfigPorDefecto: false,
    niveles: niveles.map((n) => ({
      nivel: n.nivel,
      aplica: n.aplica,
      idUsuarioJefeVista: n.idUsuarioJefeVista ?? null,
      idUsuarioJefeOverride: n.idUsuarioJefeOverride ?? null,
      nombreJefeVista: n.nombreJefeVista ?? null,
      nombreJefeOverride: n.nombreJefeOverride ?? null,
    })),
  };
}

describe('pasoSeOmitira', () => {
  it('no omite el paso cuando el nivel tiene jefe con cuenta', () => {
    const cfg = config([{ nivel: 1, aplica: true, idUsuarioJefeVista: 82 }]);

    expect(pasoSeOmitira(pasoJefe(1), cfg, new Set())).toBe(false);
  });

  it('omite el paso cuando el nivel no tiene jefe resuelto', () => {
    const cfg = config([{ nivel: 4, aplica: true, idUsuarioJefeVista: null }]);

    expect(pasoSeOmitira(pasoJefe(4), cfg, new Set())).toBe(true);
  });

  it('omite el paso cuando el nivel no aplica para el empleado', () => {
    const cfg = config([{ nivel: 2, aplica: false, idUsuarioJefeVista: 56 }]);

    expect(pasoSeOmitira(pasoJefe(2), cfg, new Set())).toBe(true);
  });

  it('omite el paso cuando el jefe está excluido en el workflow', () => {
    const cfg = config([{ nivel: 1, aplica: true, idUsuarioJefeVista: 20 }]);

    expect(pasoSeOmitira(pasoJefe(1), cfg, new Set([20]))).toBe(true);
  });

  it('usa el override aunque la vista no tenga jefe', () => {
    const cfg = config([
      { nivel: 4, aplica: true, idUsuarioJefeVista: null, idUsuarioJefeOverride: 71 },
    ]);

    expect(pasoSeOmitira(pasoJefe(4), cfg, new Set())).toBe(false);
  });

  it('no omite pasos con participantes mixtos o sin participantes', () => {
    const cfg = config([{ nivel: 1, aplica: false }]);
    const mixto = pasoJefe(1);
    mixto.participantes = [
      { requiereJefeInmediato: true, nivelJefe: 1 },
      { requiereJefeInmediato: false, idUsuario: 75 },
    ];

    expect(pasoSeOmitira(mixto, cfg, new Set())).toBe(false);
    expect(pasoSeOmitira({ ...pasoJefe(1), participantes: [] }, cfg, new Set())).toBe(false);
  });

  it('sin configuración cargada no filtra nada (fallback)', () => {
    expect(pasoSeOmitira(pasoJefe(4), null, new Set())).toBe(false);
  });
});

describe('responsablesJefePaso', () => {
  it('devuelve el nombre del jefe de la vista del nivel configurado', () => {
    const cfg = config([
      {
        nivel: 1,
        aplica: true,
        idUsuarioJefeVista: 82,
        nombreJefeVista: '82 Juan Pérez López',
      },
    ]);

    expect(responsablesJefePaso(pasoJefe(1), cfg, new Set())).toEqual(['82 Juan Pérez López']);
  });

  it('prefiere el nombre del override sobre el de la vista', () => {
    const cfg = config([
      {
        nivel: 2,
        aplica: true,
        idUsuarioJefeVista: 82,
        nombreJefeVista: '82 Juan Pérez López',
        idUsuarioJefeOverride: 71,
        nombreJefeOverride: '71 Ana Ruiz',
      },
    ]);

    expect(responsablesJefePaso(pasoJefe(2), cfg, new Set())).toEqual(['71 Ana Ruiz']);
  });

  it('no devuelve nombre si el nivel no aplica, no hay jefe o está excluido', () => {
    const noAplica = config([
      { nivel: 2, aplica: false, idUsuarioJefeVista: 56, nombreJefeVista: '56 Sin Aplica' },
    ]);
    const sinJefe = config([{ nivel: 4, aplica: true, idUsuarioJefeVista: null }]);
    const excluido = config([
      { nivel: 1, aplica: true, idUsuarioJefeVista: 20, nombreJefeVista: '20 Excluido' },
    ]);

    expect(responsablesJefePaso(pasoJefe(2), noAplica, new Set())).toEqual([]);
    expect(responsablesJefePaso(pasoJefe(4), sinJefe, new Set())).toEqual([]);
    expect(responsablesJefePaso(pasoJefe(1), excluido, new Set([20]))).toEqual([]);
  });

  it('ignora participantes que no son jefe inmediato y nombres duplicados', () => {
    const cfg = config([
      { nivel: 1, aplica: true, idUsuarioJefeVista: 82, nombreJefeVista: '82 Juan' },
    ]);
    const paso = pasoJefe(1);
    paso.participantes = [
      { requiereJefeInmediato: true, nivelJefe: 1 },
      { requiereJefeInmediato: true, nivelJefe: 1 },
      { requiereJefeInmediato: false, idUsuario: 75, nombreUsuario: '75 Otra Persona' },
    ];

    expect(responsablesJefePaso(paso, cfg, new Set())).toEqual(['82 Juan']);
  });

  it('junta los nombres de varios niveles si el paso los pide', () => {
    const cfg = config([
      { nivel: 1, aplica: true, idUsuarioJefeVista: 82, nombreJefeVista: '82 Juan' },
      { nivel: 2, aplica: true, idUsuarioJefeVista: 56, nombreJefeVista: '56 Rosa' },
    ]);
    const paso = pasoJefe(1);
    paso.participantes = [
      { requiereJefeInmediato: true, nivelJefe: 1 },
      { requiereJefeInmediato: true, nivelJefe: 2 },
    ];

    expect(responsablesJefePaso(paso, cfg, new Set())).toEqual(['82 Juan', '56 Rosa']);
  });

  it('sin configuración no resuelve nombres', () => {
    expect(responsablesJefePaso(pasoJefe(1), null, new Set())).toEqual([]);
  });
});
