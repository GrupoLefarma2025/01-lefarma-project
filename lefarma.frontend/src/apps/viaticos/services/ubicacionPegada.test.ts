import { describe, expect, it } from 'vitest';
import { extraerCoordenadas, formatearCoordenadas, interpretarEntradaPegada } from './ubicacionPegada';

describe('extraerCoordenadas', () => {
  it('acepta el formato que copia Google Maps', () => {
    expect(extraerCoordenadas('19.432608, -99.133208')).toEqual({ latitud: 19.432608, longitud: -99.133208 });
    expect(extraerCoordenadas('19.4326,-99.1332')).toEqual({ latitud: 19.4326, longitud: -99.1332 });
    expect(extraerCoordenadas(' 19.4326  -99.1332 ')).toEqual({ latitud: 19.4326, longitud: -99.1332 });
    expect(extraerCoordenadas('geo:19.4326,-99.1332')).toEqual({ latitud: 19.4326, longitud: -99.1332 });
  });

  it('rechaza textos normales y pares fuera de rango', () => {
    expect(extraerCoordenadas('hospital xoco')).toBeNull();
    expect(extraerCoordenadas('19.4326')).toBeNull();
    expect(extraerCoordenadas('95, -99.13')).toBeNull();
    expect(extraerCoordenadas('19.43, 200')).toBeNull();
    expect(extraerCoordenadas('calle 5 de mayo 20')).toBeNull();
  });
});

describe('interpretarEntradaPegada', () => {
  it('detecta coordenadas directas antes que cualquier otra forma', () => {
    expect(interpretarEntradaPegada('19.3905, -99.1213')).toEqual({ tipo: 'coordenadas', latitud: 19.3905, longitud: -99.1213 });
  });

  it('lee ligas largas de Google Maps (data > arroba y q=)', () => {
    expect(interpretarEntradaPegada('https://www.google.com/maps/place/Hospital/@19.3603343,-99.1624076,17z/data=!3d19.3604000!4d-99.1625000'))
      .toEqual({ tipo: 'coordenadas', latitud: 19.3604, longitud: -99.1625 });
    expect(interpretarEntradaPegada('https://www.google.com/maps/place/Hospital/@19.3905,-99.1213,17z'))
      .toEqual({ tipo: 'coordenadas', latitud: 19.3905, longitud: -99.1213 });
    expect(interpretarEntradaPegada('https://maps.google.com/?q=19.3905,-99.1213'))
      .toEqual({ tipo: 'coordenadas', latitud: 19.3905, longitud: -99.1213 });
    expect(interpretarEntradaPegada('https://www.google.com/maps/dir/?api=1&destination=19.3905,-99.1213'))
      .toEqual({ tipo: 'coordenadas', latitud: 19.3905, longitud: -99.1213 });
  });

  it('con q/query de texto busca el nombre del lugar', () => {
    expect(interpretarEntradaPegada('https://www.google.com/maps/search/?api=1&query=Hospital+General+Xoco'))
      .toEqual({ tipo: 'busqueda', texto: 'Hospital General Xoco' });
  });

  it('lee ligas de OpenStreetMap y Apple Maps', () => {
    expect(interpretarEntradaPegada('https://www.openstreetmap.org/#map=17/19.3905/-99.1213'))
      .toEqual({ tipo: 'coordenadas', latitud: 19.3905, longitud: -99.1213 });
    expect(interpretarEntradaPegada('https://www.openstreetmap.org/?mlat=19.3905&mlon=-99.1213'))
      .toEqual({ tipo: 'coordenadas', latitud: 19.3905, longitud: -99.1213 });
    expect(interpretarEntradaPegada('https://maps.apple.com/?ll=19.3905,-99.1213'))
      .toEqual({ tipo: 'coordenadas', latitud: 19.3905, longitud: -99.1213 });
  });

  it('reconoce ligas cortas, con o sin esquema', () => {
    expect(interpretarEntradaPegada('https://maps.app.goo.gl/AbC123')).toEqual({ tipo: 'liga-corta' });
    expect(interpretarEntradaPegada('maps.app.goo.gl/AbC123')).toEqual({ tipo: 'liga-corta' });
    expect(interpretarEntradaPegada('https://goo.gl/maps/AbC123')).toEqual({ tipo: 'liga-corta' });
    expect(interpretarEntradaPegada('https://g.co/kgs/AbC123')).toEqual({ tipo: 'liga-corta' });
    expect(interpretarEntradaPegada('https://osm.org/go/AbC123')).toEqual({ tipo: 'liga-corta' });
  });

  it('devuelve null para texto normal o ligas sin coordenadas', () => {
    expect(interpretarEntradaPegada('Av. Reforma 123, CDMX')).toBeNull();
    expect(interpretarEntradaPegada('https://example.com/hola')).toBeNull();
    expect(interpretarEntradaPegada('https://www.openstreetmap.org/node/12345')).toBeNull();
  });
});

describe('formatearCoordenadas', () => {
  it('normaliza a cinco decimales', () => {
    expect(formatearCoordenadas(19.4395, -99.1332)).toBe('19.43950, -99.13320');
  });
});
