import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validarCotizacion, type Esquema } from './validadorCotizacion';

// Contrato de cotizacion de viajes (pi): el JSON se valida contra el schema
// oficial de lefarma.docs con el validador propio de ./validadorCotizacion.ts
// (sin ajv ni dependencias nuevas).

interface DatosCotizacion {
  [campo: string]: unknown;
  opciones: Array<Record<string, unknown>>;
}

const rutaSchema = '../../../../../lefarma.docs/viaticos/schemas/cotizacion-viajes.schema.json';
const rutaFixture = '../test/fixtures/cotizacion-ejemplo.json';

const leerJson = (ruta: string): DatosCotizacion =>
  JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8')) as DatosCotizacion;

// Se relee el archivo en cada caso: ningun estado se comparte entre tests y el
// resultado no depende del orden de ejecucion.
const esquema = leerJson(rutaSchema) as unknown as Esquema;
const clonarFixture = (): DatosCotizacion => leerJson(rutaFixture);

describe('contrato de cotizacion de viajes (pi)', () => {
  it('(a) el fixture cotizacion-ejemplo.json es valido', () => {
    const datos = clonarFixture();
    const resultado = validarCotizacion(datos, esquema);
    expect(resultado.errores).toEqual([]);
    expect(resultado.valido).toBe(true);
    expect(datos.opciones.map(opcion => opcion.modo)).toEqual(['avion', 'avion', 'hotel']);
  });

  it('(b) una opcion sin url_compra es invalida', () => {
    const datos = clonarFixture();
    delete datos.opciones[0].url_compra;
    const resultado = validarCotizacion(datos, esquema);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.join('\n')).toMatch(/\.url_compra: campo requerido ausente/);
  });

  it('(c) una opcion sin fuente es invalida', () => {
    const datos = clonarFixture();
    delete datos.opciones[0].fuente;
    const resultado = validarCotizacion(datos, esquema);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.join('\n')).toMatch(/\.fuente: campo requerido ausente/);
  });

  it('(d) sin transportistas_no_encontrados es invalido (honestidad de cobertura)', () => {
    const datos = clonarFixture();
    delete datos.transportistas_no_encontrados;
    const resultado = validarCotizacion(datos, esquema);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.join('\n')).toMatch(/transportistas_no_encontrados: campo requerido ausente/);
  });

  it('(e) precio null con fuente "estimado" es valido, y solo con esa fuente', () => {
    const estimado = clonarFixture();
    estimado.opciones[0].precio = null;
    estimado.opciones[0].fuente = 'estimado';
    const ok = validarCotizacion(estimado, esquema);
    expect(ok.errores).toEqual([]);
    expect(ok.valido).toBe(true);

    // Regla documentada en la descripcion del campo precio: null SOLO si
    // fuente == "estimado"; cualquier otra fuente con precio null es invalida.
    const sinFuenteEstimado = clonarFixture();
    sinFuenteEstimado.opciones[0].precio = null;
    const resultado = validarCotizacion(sinFuenteEstimado, esquema);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.join('\n')).toMatch(/\.fuente: debe ser "estimado"/);
  });
});
