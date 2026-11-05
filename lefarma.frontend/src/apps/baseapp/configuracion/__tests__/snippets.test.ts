import { describe, expect, it } from 'vitest';
import type { VariableConfiguracion } from '../types';
import {
  generarSnippet,
  lenguajeApiPredeterminado,
  opcionesLenguajeApi,
  opcionesSnippet,
  type LenguajeApi,
} from '../snippets';

const variable = (parcial: Partial<VariableConfiguracion> = {}): VariableConfiguracion => ({
  idVariable: 1,
  clave: 'pruebas.entero',
  nombre: 'Entero de prueba',
  descripcion: null,
  tipoDato: 'integer',
  valor: 42,
  esquema: null,
  disponibleBackend: true,
  disponibleFrontend: true,
  disponibleSql: true,
  disponibleIntegraciones: true,
  activo: true,
  version: 1,
  fechaCreacion: '2026-11-05T00:00:00.000Z',
  fechaModificacion: '2026-11-05T00:00:00.000Z',
  ...parcial,
});

describe('snippets de configuración', () => {
  it('genera código para todos los lenguajes de API', () => {
    const lenguajes: LenguajeApi[] = [
      'curl',
      'powershell',
      'python',
      'csharp',
      'javascript',
      'typescript',
      'vba',
      'tsql',
    ];

    for (const lenguaje of lenguajes) {
      const codigo = generarSnippet(variable(), 'api', lenguaje);
      expect(codigo.length).toBeGreaterThan(20);
    }
  });

  it('genera los lenguajes externos con endpoint y X-API-Key', () => {
    const v = variable();

    expect(generarSnippet(v, 'api', 'curl')).toContain('curl --request GET');
    expect(generarSnippet(v, 'api', 'powershell')).toContain('Invoke-RestMethod');
    expect(generarSnippet(v, 'api', 'python')).toContain('requests.get');
    expect(generarSnippet(v, 'api', 'csharp')).toContain('HttpClient');
    expect(generarSnippet(v, 'api', 'javascript')).toContain('fetch');
    expect(generarSnippet(v, 'api', 'typescript')).toContain('interface RespuestaVariable');
    expect(generarSnippet(v, 'api', 'typescript')).toContain('valor: number');
    expect(generarSnippet(v, 'api', 'vba')).toContain('WinHttp.WinHttpRequest.5.1');

    for (const lenguaje of ['curl', 'powershell', 'python', 'csharp', 'javascript', 'typescript', 'vba'] as const) {
      const codigo = generarSnippet(v, 'api', lenguaje);
      expect(codigo).toContain('/api/configuracion/integraciones/variables/pruebas.entero');
      expect(codigo).toContain('X-API-Key');
    }
  });

  it('T-SQL usa la función local y no una petición HTTP', () => {
    const codigo = generarSnippet(variable(), 'api', 'tsql');

    expect(codigo).toContain("config.fn_obtener_variable(N'pruebas.entero')");
    expect(codigo).not.toContain('X-API-Key');
    expect(codigo).not.toContain('curl');
  });

  it('habilita cada lenguaje según los destinos de la variable', () => {
    const ambos = opcionesLenguajeApi(variable());
    expect(ambos.filter((opcion) => opcion.disponible).map((opcion) => opcion.valor)).toEqual([
      'curl',
      'powershell',
      'python',
      'csharp',
      'javascript',
      'typescript',
      'vba',
      'tsql',
    ]);

    const soloSql = opcionesLenguajeApi(
      variable({ disponibleIntegraciones: false, disponibleSql: true }),
    );
    expect(soloSql.find((opcion) => opcion.valor === 'curl')?.disponible).toBe(false);
    expect(soloSql.find((opcion) => opcion.valor === 'tsql')?.disponible).toBe(true);
    expect(lenguajeApiPredeterminado(variable({ disponibleIntegraciones: false }))).toBe('tsql');

    const sinSql = opcionesLenguajeApi(variable({ disponibleSql: false }));
    expect(sinSql.find((opcion) => opcion.valor === 'tsql')?.disponible).toBe(false);
  });

  it('ofrece API externa si la variable tiene Integraciones o SQL', () => {
    expect(
      opcionesSnippet(variable({ disponibleIntegraciones: false, disponibleSql: true })).find(
        (opcion) => opcion.tipo === 'api',
      )?.disponible,
    ).toBe(true);

    expect(
      opcionesSnippet(variable({ disponibleIntegraciones: false, disponibleSql: false })).find(
        (opcion) => opcion.tipo === 'api',
      )?.disponible,
    ).toBe(false);
  });

  it('conserva los snippets internos de frontend, backend y SQL', () => {
    const v = variable();

    expect(generarSnippet(v, 'frontend')).toContain("useConfig<number>('pruebas.entero')");
    expect(generarSnippet(v, 'backend')).toContain('GetAsync<int>');
    expect(generarSnippet(v, 'sql')).toContain('TRY_CONVERT(int');
  });
});
