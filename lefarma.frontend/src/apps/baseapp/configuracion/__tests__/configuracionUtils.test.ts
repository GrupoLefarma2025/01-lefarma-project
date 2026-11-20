import { describe, expect, it, vi } from 'vitest';
import {
  aSegmentoClave,
  aSegmentoClaveAlEscribir,
  calcularDiff,
  construirClave,
  construirEsquema,
  depurarValorSegunEsquema,
  esquemaACampos,
  namespaceDeClave,
  namespacesDeVariables,
  normalizarTipoDato,
  patronesAlcanceIntegracion,
  nuevoIdOperacion,
  tipoDatoBackend,
  validarClave,
  validarValorVariable,
  valorInicialFormulario,
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
    expect(construirClave('', 'Días límite')).toBe('');
  });

  it('extrae y ordena namespaces únicos desde las claves', () => {
    expect(namespaceDeClave('pruebas.entero')).toBe('pruebas');
    expect(namespaceDeClave('macroventas.contrasena')).toBe('macroventas');
    expect(namespaceDeClave('sinnamespace')).toBe('sinnamespace');
    expect(
      namespacesDeVariables([
        { clave: 'pruebas.entero' },
        { clave: 'zona.clave' },
        { clave: 'pruebas.otra' },
      ]),
    ).toEqual(['pruebas', 'zona']);
  });

  it('calcula el alcance de una llave de integración por módulo, namespace o clave', () => {
    const variables = [
      { clave: 'global.configuracion.enviar' },
      { clave: 'global.configuracion.otra' },
      { clave: 'global.pagos.terminal' },
      { clave: 'viaticos.configuracion.limite' },
      { clave: 'viaticos.catalogo.dias' },
      { clave: 'legado.clave' },
    ];

    expect(patronesAlcanceIntegracion(variables, null, null, null)).toEqual([]);
    expect(patronesAlcanceIntegracion(variables, 'global', null, null)).toEqual(['global.*']);
    expect(patronesAlcanceIntegracion(variables, 'global', 'configuracion', null)).toEqual([
      'global.configuracion.*',
    ]);
    expect(patronesAlcanceIntegracion(variables, null, 'configuracion', null)).toEqual([
      'global.configuracion.*',
      'viaticos.configuracion.*',
    ]);
    expect(patronesAlcanceIntegracion(variables, null, 'legado', null)).toEqual(['legado.*']);
    expect(patronesAlcanceIntegracion(variables, null, null, 'global.pagos.terminal')).toEqual([
      'global.pagos.terminal',
    ]);
  });

  it('genera idOperacion UUID aun cuando randomUUID no está disponible', () => {
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = i;
        return bytes;
      },
    });

    try {
      expect(nuevoIdOperacion()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });

  it('no inventa valores de negocio al elegir un tipo', () => {
    expect(valorInicialFormulario('texto_corto')).toBe('');
    expect(valorInicialFormulario('entero')).toBeNull();
    expect(valorInicialFormulario('decimal')).toBeNull();
    expect(valorInicialFormulario('booleano')).toBeNull();
    expect(valorInicialFormulario('json')).toBe('');
    expect(valorInicialFormulario('entero', true)).toEqual([]);
  });

  it('convierte un tipo simple en lista mediante la casilla', () => {
    const esquema = construirEsquema({
      tipo: 'entero',
      esLista: true,
      campos: [],
      opciones: [],
      clavesAdicionales: false,
    });

    expect(esquema).toEqual({ type: 'array', items: { type: 'integer' } });
  });

  it('convierte un objeto en lista de objetos sin cambiar el backend', () => {
    const esquema = construirEsquema({
      tipo: 'objeto',
      esLista: true,
      clavesAdicionales: false,
      opciones: [],
      campos: [campo({ nombre: 'moneda', tipo: 'texto_corto', obligatorio: true })],
    });

    expect(esquema).toMatchObject({
      type: 'array',
      items: {
        type: 'object',
        required: ['moneda'],
        properties: { moneda: { type: 'string' } },
      },
    });
  });

  it('reconstruye la casilla lista desde un array existente', () => {
    const campos = esquemaACampos({
      type: 'object',
      properties: {
        dias: { type: 'array', items: { type: 'integer' } },
      },
    });

    expect(campos[0]).toMatchObject({
      nombre: 'dias',
      tipo: 'entero',
      esLista: true,
    });
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

  it('normaliza los segmentos de clave mientras se escriben', () => {
    expect(aSegmentoClave('Dias')).toBe('dias');
    expect(aSegmentoClave('Días límite')).toBe('dias_limite');
    expect(aSegmentoClave('dias limite')).toBe('dias_limite');
    expect(aSegmentoClave('dias-límite!')).toBe('diaslimite');
    expect(aSegmentoClave('  varios   espacios  ')).toBe('varios_espacios');
    expect(aSegmentoClave('123 clave')).toBe('clave');
    expect(aSegmentoClave('___')).toBe('');
    expect(aSegmentoClave('clave.mala')).toBe('clavemala');
  });

  it('conserva el guion bajo del espacio recién escrito', () => {
    expect(aSegmentoClaveAlEscribir('dias ')).toBe('dias_');
    expect(aSegmentoClaveAlEscribir('dias l')).toBe('dias_l');
    expect(aSegmentoClaveAlEscribir('dias_limite ')).toBe('dias_limite_');
    expect(aSegmentoClaveAlEscribir('dias')).toBe('dias');
    expect(aSegmentoClaveAlEscribir(' ')).toBe('');
  });

  it('acepta guiones bajos en las claves', () => {
    expect(validarClave('viaticos.catalogo.dias_limite', { requiereModulo: true })).toBeNull();
    expect(validarClave('catalogo.dias_limite')).toBeNull();
    expect(validarClave('viaticos.catalogo.dias limite', { requiereModulo: true })).not.toBeNull();
  });

  it('mapea los rangos al valor canónico del backend', () => {
    expect(tipoDatoBackend('rango_fecha')).toBe('date_range');
    expect(tipoDatoBackend('rango_fecha_hora')).toBe('datetime_range');
    expect(tipoDatoBackend('rango_entero')).toBe('integer_range');
    expect(tipoDatoBackend('rango_decimal')).toBe('decimal_range');
    expect(normalizarTipoDato('date_range')).toBe('rango_fecha');
    expect(normalizarTipoDato('datetime_range')).toBe('rango_fecha_hora');
    expect(normalizarTipoDato('integer_range')).toBe('rango_entero');
    expect(normalizarTipoDato('decimal_range')).toBe('rango_decimal');
  });

  it('construye el esquema de un rango como objeto desde/hasta', () => {
    expect(
      construirEsquema({
        tipo: 'rango_fecha',
        campos: [],
        opciones: [],
        clavesAdicionales: false,
      }),
    ).toEqual({
      type: 'object',
      required: ['desde', 'hasta'],
      additionalProperties: false,
      properties: {
        desde: { type: 'string', format: 'date' },
        hasta: { type: 'string', format: 'date' },
      },
    });

    expect(
      construirEsquema({
        tipo: 'rango_entero',
        esLista: true,
        campos: [],
        opciones: [],
        clavesAdicionales: false,
      }),
    ).toEqual({
      type: 'array',
      items: {
        type: 'object',
        required: ['desde', 'hasta'],
        additionalProperties: false,
        properties: {
          desde: { type: 'integer' },
          hasta: { type: 'integer' },
        },
      },
    });
  });

  it('valida que el rango tenga ambos extremos y en orden', () => {
    expect(
      validarValorVariable('rango_fecha', { desde: '2026-01-01', hasta: '2026-03-31' }, null),
    ).toEqual([]);
    expect(validarValorVariable('rango_fecha', { desde: '2026-01-01' }, null)).toHaveLength(1);
    expect(
      validarValorVariable('rango_fecha', { desde: '2026-03-31', hasta: '2026-01-01' }, null)[0],
    ).toContain('no puede ser mayor');

    expect(validarValorVariable('rango_fecha_hora', {
      desde: '2026-01-01T08:00:00.000Z',
      hasta: '2026-01-01T18:00:00.000Z',
    }, null)).toEqual([]);

    expect(validarValorVariable('rango_entero', { desde: 10, hasta: 20 }, null)).toEqual([]);
    expect(validarValorVariable('rango_entero', { desde: 10.5, hasta: 20 }, null)).toHaveLength(1);
    expect(validarValorVariable('rango_decimal', { desde: 1.5, hasta: 9.99 }, null)).toEqual([]);
    expect(validarValorVariable('rango_fecha', null, null)).toHaveLength(1);
  });

  it('reconoce el tipo de un rango al leer el esquema', () => {
    const [vigencia] = esquemaACampos({
      type: 'object',
      properties: {
        vigencia: {
          type: 'object',
          required: ['desde', 'hasta'],
          properties: {
            desde: { type: 'string', format: 'date' },
            hasta: { type: 'string', format: 'date' },
          },
        },
      },
    });

    expect(vigencia.tipo).toBe('rango_fecha');
  });
});
