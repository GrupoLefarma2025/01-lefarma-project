// Validacion de URLs para evitar SSRF: solo http/https publicos.
import dns from 'node:dns/promises';
import net from 'node:net';

const HOSTS_BLOQUEADOS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

const SUFIJOS_BLOQUEADOS = ['.local', '.internal', '.localhost', '.home.arpa', '.lan'];

function ipv4AEntero(ip) {
  return ip.split('.').reduce((acumulado, octeto) => (acumulado << 8) + Number(octeto), 0) >>> 0;
}

const RANGOS_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].map(([base, bits]) => {
  const mascara = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return [ipv4AEntero(base), mascara];
});

export function ipPrivada(ip) {
  const tipo = net.isIP(ip);
  if (tipo === 4) {
    const valor = ipv4AEntero(ip);
    return RANGOS_V4.some(([base, mascara]) => ((valor & mascara) >>> 0) === base);
  }
  if (tipo === 6) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(x)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(x)) return true;
    if (x.startsWith('2001:db8')) return true;
    if (x.startsWith('::ffff:')) return ipPrivada(x.slice('::ffff:'.length));
    return false;
  }
  return true;
}

export function errorHttp(status, mensaje, extra) {
  const error = new Error(mensaje);
  error.status = status;
  if (extra) error.extra = extra;
  return error;
}

export async function validarUrl(texto) {
  let url;
  try {
    url = new URL(texto);
  } catch {
    throw errorHttp(400, 'URL invalida');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw errorHttp(400, 'Solo se permiten URLs http o https');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) throw errorHttp(400, 'URL sin host');
  if (HOSTS_BLOQUEADOS.has(host) || SUFIJOS_BLOQUEADOS.some((sufijo) => host.endsWith(sufijo))) {
    throw errorHttp(400, `Host bloqueado: ${host}`);
  }
  if (net.isIP(host)) {
    if (ipPrivada(host)) throw errorHttp(400, `IP privada bloqueada: ${host}`);
    return url;
  }
  let direcciones;
  try {
    direcciones = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw errorHttp(400, `No se pudo resolver el host: ${host}`);
  }
  for (const direccion of direcciones) {
    if (ipPrivada(direccion.address)) {
      throw errorHttp(400, `Host resuelve a una IP privada: ${host} -> ${direccion.address}`);
    }
  }
  return url;
}

export function nombreSeguro(texto, porDefecto = 'captura') {
  const limpio = String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return limpio || porDefecto;
}
