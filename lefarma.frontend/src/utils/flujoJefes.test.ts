import { describe, expect, it } from 'vitest';
import type { EmpleadoJefesConfigResponse } from '@/types/jefesNiveles.types';
import type { WorkflowPasoFlowResponse } from '@/types/solicitudPersonalWorkflow.types';
import { pasoSeOmitira } from './flujoJefes';

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
