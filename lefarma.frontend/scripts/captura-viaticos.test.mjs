/**
 * Tests de la defensa SSRF del lado Node de captura-viaticos.mjs.
 *
 * El script es la ultima linea: el backend lo invoca como proceso, asi que
 * estas reglas se ejecutan aunque CapturasServiceTests del backend pasen.
 * Con lista blanca VACIA (estado por defecto de este repo) la defensa debe:
 *   - rechazar esquemas no http/https,
 *   - rechazar destinos internos/privados (loopback, link-local, RFC1918),
 *   - rechazar los dominios prohibidos por plan (booking, expedia),
 *   - y SEGUIR ACEPTANDO los sitios legitimos de compra (controles).
 */

import { describe, expect, it } from 'vitest';
import {
  hostIsBanned,
  isInternalHost,
  isWhitelistEmpty,
  urlRejectionReason,
} from './captura-viaticos.mjs';

// Precondicion de todos los casos: con whitelist poblada el resto de reglas
// sigue aplicando, pero estos tests describen el estado real del repo.
describe('captura-viaticos: precondiciones', () => {
  it('la lista blanca esta vacia por defecto', () => {
    expect(isWhitelistEmpty()).toBe(true);
  });
});

describe('urlRejectionReason: esquemas no permitidos', () => {
  it('rechaza file://', () => {
    expect(urlRejectionReason('file:///algo')).toMatch(/esquema no permitido/);
  });

  it('rechaza data:text/html', () => {
    expect(urlRejectionReason('data:text/html,<h1>hola</h1>')).toMatch(/esquema no permitido/);
  });
});

describe('urlRejectionReason: destinos internos', () => {
  it('rechaza metadata de la nube (169.254.169.254)', () => {
    expect(urlRejectionReason('http://169.254.169.254/')).toMatch(/destino interno o privado/);
  });

  it('rechaza localhost', () => {
    expect(urlRejectionReason('http://localhost:3000')).toMatch(/destino interno o privado/);
  });

  it('rechaza loopback IPv4 (127.0.0.1)', () => {
    expect(urlRejectionReason('http://127.0.0.1')).toMatch(/destino interno o privado/);
  });
});

describe('urlRejectionReason: dominios prohibidos por plan', () => {
  it('rechaza booking.com y sus subdominios', () => {
    expect(urlRejectionReason('https://booking.com')).toMatch(/dominio prohibido por plan/);
    expect(urlRejectionReason('https://www.booking.com/hotel/x')).toMatch(
      /dominio prohibido por plan/,
    );
    expect(hostIsBanned('booking.com')).toBe(true);
  });

  it('rechaza expedia.com y sus subdominios', () => {
    expect(urlRejectionReason('https://expedia.com')).toMatch(/dominio prohibido por plan/);
    expect(urlRejectionReason('https://www.expedia.com/Flights')).toMatch(
      /dominio prohibido por plan/,
    );
    expect(hostIsBanned('expedia.com')).toBe(true);
  });
});

describe('urlRejectionReason: controles (no comerse los sitios legitimos)', () => {
  it('ACEPTA clickbus', () => {
    expect(urlRejectionReason('https://www.clickbus.com.mx')).toBeNull();
  });

  it('ACEPTA vivaaerobus', () => {
    expect(urlRejectionReason('https://www.vivaaerobus.com')).toBeNull();
  });

  it('ACEPTA otros transportistas publicos', () => {
    expect(urlRejectionReason('https://www.avianca.com')).toBeNull();
    expect(urlRejectionReason('https://www.latamairlines.com')).toBeNull();
  });

  it('ACEPTA example.com y no lo marca como interno', () => {
    expect(urlRejectionReason('https://example.com')).toBeNull();
    expect(isInternalHost('example.com')).toBe(false);
  });
});

describe('urlRejectionReason: otros casos de la defensa', () => {
  it('rechaza entradas vacias o no parseables', () => {
    expect(urlRejectionReason('')).toMatch(/URL invalida o vacia/);
    expect(urlRejectionReason('no-es-una-url')).toMatch(/URL invalida o vacia/);
  });

  it('rechaza sufijos de intranet y rangos privados', () => {
    expect(urlRejectionReason('http://servidor.local')).toMatch(/destino interno o privado/);
    expect(urlRejectionReason('http://api.internal')).toMatch(/destino interno o privado/);
    expect(urlRejectionReason('http://app.localhost')).toMatch(/destino interno o privado/);
    expect(urlRejectionReason('http://10.0.0.5')).toMatch(/destino interno o privado/);
    expect(urlRejectionReason('http://192.168.1.1')).toMatch(/destino interno o privado/);
    expect(urlRejectionReason('http://172.16.0.1')).toMatch(/destino interno o privado/);
  });

  it('rechaza loopback IPv6', () => {
    expect(urlRejectionReason('http://[::1]:5174')).toMatch(/destino interno o privado/);
  });
});