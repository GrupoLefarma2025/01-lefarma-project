import { describe, expect, it } from 'vitest';
import {
  etiquetaResponsables,
  nombresResponsablesPaso,
  tituloPasoResponsable,
} from './responsablesPaso';

describe('nombresResponsablesPaso', () => {
  it('prefiere el usuario explícito del paso', () => {
    expect(
      nombresResponsablesPaso([
        { nombreUsuario: 'Victor Manuel Gonzalez Betanzos', nombreRol: null },
      ])
    ).toEqual(['Victor Manuel Gonzalez Betanzos']);
  });

  it('usa el rol cuando el participante no tiene usuario explícito', () => {
    expect(
      nombresResponsablesPaso([{ nombreUsuario: null, nombreRol: 'Gerente General' }])
    ).toEqual(['Gerente General']);
  });

  it('usa el jefe inmediato con su nivel cuando no hay usuario ni rol', () => {
    expect(
      nombresResponsablesPaso([
        { requiereJefeInmediato: true, nivelJefe: 2 },
        { requiereJefeInmediato: true, nivelJefe: null },
      ])
    ).toEqual(['Jefe inmediato nivel 2', 'Jefe inmediato nivel 1']);
  });

  it('ignora participantes sin nombre y deduplica', () => {
    expect(
      nombresResponsablesPaso([
        { nombreUsuario: 'Ana' },
        { nombreUsuario: 'Ana' },
        { nombreUsuario: null, nombreRol: null, requiereJefeInmediato: false },
      ])
    ).toEqual(['Ana']);
  });

  it('devuelve arreglo vacío sin participantes', () => {
    expect(nombresResponsablesPaso(undefined)).toEqual([]);
    expect(nombresResponsablesPaso([])).toEqual([]);
  });
});

describe('etiquetaResponsables', () => {
  it('usa singular para un responsable', () => {
    expect(etiquetaResponsables(['Ana'])).toBe('Responsable: Ana');
  });

  it('usa plural y separa con punto medio', () => {
    expect(etiquetaResponsables(['Ana', 'Beto'])).toBe('Responsables: Ana · Beto');
  });

  it('no devuelve texto sin responsables', () => {
    expect(etiquetaResponsables([])).toBe('');
  });
});

describe('tituloPasoResponsable', () => {
  const participantes = [
    {
      nombreUsuario: 'Victor Manuel Gonzalez Betanzos',
      puestoUsuario: 'JEFE DE LICITACIONES',
    },
  ];

  it('cambia el paso genérico por el nombre y puesto del responsable', () => {
    expect(tituloPasoResponsable('Aprobación Gerente General', participantes)).toBe(
      'Aprobación Victor Manuel Gonzalez Betanzos — JEFE DE LICITACIONES'
    );
  });

  it('tolera espacios y minúsculas en el nombre configurado', () => {
    expect(tituloPasoResponsable('  aprobación gerente general ', participantes)).toBe(
      'Aprobación Victor Manuel Gonzalez Betanzos — JEFE DE LICITACIONES'
    );
  });

  it('muestra solo el nombre si no hay puesto disponible', () => {
    expect(
      tituloPasoResponsable('Aprobación Gerente General', [
        { nombreUsuario: 'Victor Manuel Gonzalez Betanzos', puestoUsuario: null },
      ])
    ).toBe('Aprobación Victor Manuel Gonzalez Betanzos');
  });

  it('no toca los demás pasos del flujo', () => {
    expect(tituloPasoResponsable('Validación Gerente de Finanzas', participantes)).toBe(
      'Validación Gerente de Finanzas'
    );
    expect(tituloPasoResponsable('Aprobación Dirección Corporativa', participantes)).toBe(
      'Aprobación Dirección Corporativa'
    );
  });

  it('conserva el nombre original si no hay responsable resoluble', () => {
    expect(tituloPasoResponsable('Aprobación Gerente General', [])).toBe(
      'Aprobación Gerente General'
    );
    expect(tituloPasoResponsable('Aprobación Gerente General', undefined)).toBe(
      'Aprobación Gerente General'
    );
    expect(
      tituloPasoResponsable('Aprobación Gerente General', [
        { nombreUsuario: null, nombreRol: 'Gerente General' },
      ])
    ).toBe('Aprobación Gerente General');
  });
});
