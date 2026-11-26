import {
  comidaDesdeSnapshot,
  leerCalculoDesdeDatos,
  resumenCostosRuta,
} from '../../services/calculoViaje';
import type {
  CalculoViaje,
  OpcionCotizacion,
  OrigenPropuesta,
  PropuestaVersion,
  ResumenCostosRuta,
  Solicitud,
  SolicitudOpcion,
} from '../../types/solicitud.types';

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

function esCalculo(valor: unknown): valor is CalculoViaje {
  const calculo = objeto(valor);
  return (
    calculo !== null
    && Array.isArray(calculo.tramos)
    && (calculo.modo_transporte === 'propio' || calculo.modo_transporte === 'solicitado')
  );
}

function esOpcion(valor: unknown): valor is OpcionCotizacion {
  const opcion = objeto(valor);
  return (
    opcion !== null
    && typeof opcion.tipo === 'string'
    && typeof opcion.linea === 'string'
    && typeof opcion.fuente === 'string'
    && typeof opcion.fue_elegida === 'boolean'
  );
}

function leerResumen(valor: unknown): ResumenCostosRuta | null {
  const resumen = objeto(valor);
  if (resumen === null) return null;
  const claves = ['autobus', 'avion', 'gasolina', 'casetas', 'hospedaje', 'comida', 'taxi', 'total'];
  if (!claves.every((clave) => resumen[clave] === null || numero(resumen[clave]) !== null)) {
    return null;
  }
  return {
    autobus: numero(resumen.autobus),
    avion: numero(resumen.avion),
    gasolina: numero(resumen.gasolina),
    casetas: numero(resumen.casetas),
    hospedaje: numero(resumen.hospedaje),
    comida: numero(resumen.comida),
    taxi: numero(resumen.taxi),
    total: numero(resumen.total),
  };
}

function origenPropuesta(valor: unknown): OrigenPropuesta {
  return valor === 'costos' || valor === 'calculo' ? valor : 'recalculo';
}

function leerVersion(valor: unknown): PropuestaVersion | null {
  const version = objeto(valor);
  if (version === null) return null;
  const numeroVersion = numero(version.numero);
  const calculo = version.calculo;
  const opciones = Array.isArray(version.opciones) ? version.opciones.filter(esOpcion) : null;
  if (numeroVersion === null || numeroVersion < 2 || !esCalculo(calculo) || opciones === null) {
    return null;
  }
  return {
    numero: numeroVersion,
    origen: origenPropuesta(version.origen),
    creado_en: texto(version.creado_en),
    calculo,
    opciones,
    resumen: leerResumen(version.resumen),
  };
}

export function opcionesDeSolicitud(opciones: SolicitudOpcion[]): OpcionCotizacion[] {
  return opciones.map((opcion) => ({
    tipo: opcion.tipo,
    linea: opcion.linea,
    precio: opcion.precio,
    moneda: opcion.moneda ?? 'MXN',
    url_compra: opcion.url_compra,
    fuente: opcion.fuente,
    fue_elegida: opcion.fue_elegida,
    ruta_captura: opcion.ruta_captura,
    capturas: opcion.ruta_captura ? [opcion.ruta_captura] : [],
    datos: opcion.datos ?? null,
  }));
}

export function versionesPersistidas(datos: unknown): PropuestaVersion[] {
  const guardadas = objeto(datos)?.propuestas_revision;
  if (!Array.isArray(guardadas)) return [];
  const versiones: PropuestaVersion[] = [];
  for (const item of guardadas) {
    const version = leerVersion(item);
    if (version === null) continue;
    if (versiones.some((existente) => existente.numero === version.numero)) continue;
    versiones.push(version);
  }
  return versiones.sort((a, b) => a.numero - b.numero);
}

export function versionOriginal(solicitud: Solicitud): PropuestaVersion | null {
  const calculo = leerCalculoDesdeDatos(solicitud.datos);
  if (calculo === null) return null;
  const opciones = opcionesDeSolicitud(solicitud.opciones);
  return {
    numero: 1,
    origen: 'calculo',
    creado_en: calculo.generado_en,
    calculo,
    opciones,
    resumen: resumenCostosRuta(
      calculo,
      opciones,
      calculo.modo_transporte,
      comidaDesdeSnapshot(solicitud.datos),
    ),
  };
}

export function historialDePropuesta(solicitud: Solicitud): PropuestaVersion[] {
  const original = versionOriginal(solicitud);
  const persistidas = versionesPersistidas(solicitud.datos);
  if (original === null) return persistidas;
  return [original, ...persistidas.filter((version) => version.numero > 1)].sort(
    (a, b) => a.numero - b.numero,
  );
}

export function fusionarVersiones(
  base: PropuestaVersion[],
  nuevas: PropuestaVersion[],
): PropuestaVersion[] {
  const resultado = [...base];
  for (const version of nuevas) {
    const indice = resultado.findIndex((existente) => existente.numero === version.numero);
    if (indice >= 0) resultado[indice] = version;
    else resultado.push(version);
  }
  return resultado.sort((a, b) => a.numero - b.numero);
}

export function etiquetaPropuesta(numeroVersion: number): string {
  return `Propuesta ${numeroVersion}`;
}
