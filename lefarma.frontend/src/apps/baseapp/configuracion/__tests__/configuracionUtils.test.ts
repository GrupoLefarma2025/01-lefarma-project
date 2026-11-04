import { describe, expect, it } from 'vitest';
import {
  calcularDiff,
  construirClave,
  construirEsquema,
  depurarValorSegunEsquema,
  esquemaACampos,
  normalizarTipoDato,
  tipoDatoBackend,
  validarValorVariable,
} from '../utils';
import type { SchemaField } from '../types';

const campo = (parcial: Partial<SchemaField>): SchemaField => ({
  id: parcial.id ?? Math.random().toString(36),
  nombre: 'x',
  tipo: 'texto_corto',
  obligatorio: false,
  ...parcial,
});

describe('configuracion utils', () => {
  it('mapea tipos de la UI al backend', () => {
    expect(tipoDatoBackend('texto_corto')).toBe('string');
    expect(tipoDatoBackend('texto_largo')).toBe('text');
    expect(tipoDatoBackend('entero')).toBe('integer');
    expect(tipoDatoBackend('fecha_hora')).toBe('datetime');
    expect(tipoDatoBackend('seleccion')).toBe('enum');
    expect(tipoDatoBackend('lista')).toBe('array');
    expect(normalizarTipoDato('datetime')).toBe('fecha_hora');
    expect(normalizarTipoDato('array')).toBe('lista');
    expect(normalizarTipoDato('text')).toBe('texto_largo');
    expect(normalizarTipoDato('string')).toBe('texto_corto');
  });

  it('genera claves namespace.clave', () => {
    expect(construirClave('viaticos', 'Días límite')).toBe('viaticos.diasLimite');
    expect(construirClave('', 'Días límite')).toBe('general.diasLimite');
  });

  it('genera un JSON Schema compatible con opciones {value}', () => {
    const esquema = construirEsquema({
      tipo: 'objeto',
      clavesAdicionales: false,
      opciones: [],
      campos: [
        campo({ nombre: 'nombre', tipo: 'texto_corto', obligatorio: true }),
        campo({
          nombre: 'estado',
          tipo: 'seleccion',
          opciones: ['activo', 'inactivo'],
          obligatorio: true,
        }),
        campo({
          nombre: 'hijos',
          tipo: 'lista',
          itemTipo: 'objeto',
          campos: [campo({ nombre: 'clave', tipo: 'texto_corto', obligatorio: true })],
        }),
      ],
    });

    expect(esquema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['nombre', 'estado'],
      properties: {
        estado: {
          type: 'string',
          enum: ['activo', 'inactivo'],
          opciones: [{ value: 'activo' }, { value: 'inactivo' }],
        },
        hijos: {
          type: 'array',
          items: {
            type: 'object',
            required: ['clave'],
            additionalProperties: false,
          },
        },
      },
    });
  });

  it('round-trip esquema → campos', () => {
    const campos = esquemaACampos({
      type: 'object',
      properties: {
        activo: { type: 'boolean' },
        fecha: { type: 'string', format: 'date' },
        color: { type: 'string', enum: ['rojo', 'azul'], opciones: [{ value: 'rojo' }] },
      },
      required: ['activo'],
      additionalProperties: false,
    });

    expect(campos.map((c) => [c.nombre, c.tipo, c.obligatorio])).toEqual([
      ['activo', 'booleano', true],
      ['fecha', 'fecha', false],
      ['color', 'seleccion', false],
    ]);
    expect(campos[2].opciones).toEqual(['rojo', 'azul']);
  });

  it('depura claves fuera del esquema', () => {
    const esquema = {
      type: 'object' as const,
      properties: { nombre: { type: 'string' as const } },
      required: ['nombre'],
      additionalProperties: false,
    };
    expect(depurarValorSegunEsquema({ nombre: 'a', viejo: 'b' }, esquema)).toEqual({
      nombre: 'a',
    });
    expect(
      depurarValorSegunEsquema({ nombre: 'a', extra: true }, {
        ...esquema,
        additionalProperties: true,
      }),
    ).toEqual({ nombre: 'a', extra: true });
  });

  it('calcula el diff por ruta y formatea valores', () => {
    const cambios = calcularDiff(
      { nombre: 'Antes', activo: true, valor: { a: 1 } },
      { nombre: 'Después', activo: true, valor: { a: 2 } },
    );
    expect(cambios.map((c) => c.ruta)).toEqual(['Nombre', 'Valor · a']);
    expect(cambios[0].antes).toBe('Antes');
  });

  it('valida fecha y hora contra el formato del backend', () => {
    expect(validarValorVariable('fecha', '2026-01-31', null)).toEqual([]);
    expect(validarValorVariable('hora', '18:30', null)).toEqual([]);
    expect(
      validarValorVariable('fecha_hora', '2026-01-31T18:30:00.000Z', null),
    ).toEqual([]);
    expect(validarValorVariable('fecha', '31/01/2026', null).length).toBe(1);
  });
});
