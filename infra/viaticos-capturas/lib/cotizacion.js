// Arma el JSON del contrato (cotizacion-viajes.schema.json v1.0.0) a partir del
// adapter de ClickBus, y opcionalmente captura la pantalla de resultados.
import {
  resolverLugar,
  buscarViajes,
  mapearOpciones,
  lugarPorSlug,
  lugarPorCoordenadas,
  extraerCoordenadas,
} from './clickbus.js';
import { capturar } from './captura.js';
import { guardarPng, urlCaptura } from './almacen.js';
import { errorHttp } from './seguridad.js';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const NO_CUBIERTOS = [
  'Primera Plus: no publica tarifas en ClickBus; se requiere captura directa en primeraplus.com.mx.',
  'ADO GL / Platino: no publica tarifas en ClickBus; se requiere captura directa en ado.com.mx.',
  'ETN Turistar: no publica tarifas en ClickBus; se requiere captura directa en etn.com.mx.',
  'VivaAerobus y demas aerolineas: los vuelos no se consultan con ClickBus; fase 2 (captura por sitio o agente).',
];

function validarConsulta({ origen, destino, fecha_salida, fecha_regreso, personas }) {
  if (!origen) throw errorHttp(400, 'Falta el campo origen (texto, coordenadas o slug)');
  if (!destino) throw errorHttp(400, 'Falta el campo destino (texto, coordenadas o slug)');
  if (!fecha_salida || !REGEX_FECHA.test(String(fecha_salida))) {
    throw errorHttp(400, 'fecha_salida debe tener formato AAAA-MM-DD');
  }
  if (fecha_regreso && !REGEX_FECHA.test(String(fecha_regreso))) {
    throw errorHttp(400, 'fecha_regreso debe tener formato AAAA-MM-DD o ir vacio');
  }
  const numeroPersonas = Number(personas ?? 1);
  if (!Number.isInteger(numeroPersonas) || numeroPersonas < 1 || numeroPersonas > 20) {
    throw errorHttp(400, 'personas debe ser un entero entre 1 y 20');
  }
  return numeroPersonas;
}

function textoCobertura({ resolucionOrigen, resolucionDestino, opciones, fechaSalida }) {
  const partes = [
    `Autobus: se consulto ClickBus (agregador de autobuses de Mexico) para la ruta ` +
      `${resolucionOrigen.name} -> ${resolucionDestino.name} el ${fechaSalida}. ` +
      `ClickBus devolvio ${opciones.length} salida(s) de las empresas que publican en su catalogo.`,
    'NO cubre lineas que no publican tarifas en ClickBus (Primera Plus, ADO GL/Platino, ETN Turistar) ni vuelos/hoteles; ' +
      'esas opciones se buscan por sitio o con el modo agentico (fase 2).',
  ];
  return partes.join(' ');
}

function textoDePunto(punto) {
  if (typeof punto === 'string') return punto.trim();
  if (punto && typeof punto === 'object') {
    const nombre = punto.nombre ?? punto.texto ?? punto.etiqueta;
    if (nombre) return String(nombre).trim();
  }
  return null;
}

function textoCoordenadas(coordenadas) {
  if (!coordenadas) return null;
  return `${coordenadas.latitud.toFixed(5)},${coordenadas.longitud.toFixed(5)}`;
}

/** Resuelve origen/destino por slug, por coordenadas o por texto (en ese orden). */
async function resolverPunto({ punto, slug, coordenadas }) {
  if (slug) {
    const lugar = await lugarPorSlug(slug);
    return { lugar, sugerencias: [], resuelto_por: 'slug', coordenadas: null };
  }
  if (coordenadas) {
    const resultado = await lugarPorCoordenadas({
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      texto: coordenadas.nombre || coordenadas.municipio || null,
    });
    return {
      lugar: resultado.lugar,
      sugerencias: resultado.sugerencias,
      resuelto_por: resultado.por,
      coordenadas: { latitud: coordenadas.latitud, longitud: coordenadas.longitud },
      distancia_km: resultado.distancia_km ?? null,
      texto_resuelto: resultado.texto_resuelto ?? null,
      reverso: resultado.reverso ?? null,
      fuera_de_mexico: resultado.fuera_de_mexico === true,
    };
  }
  const resolucion = await resolverLugar(textoDePunto(punto) || '');
  return { lugar: resolucion.lugar, sugerencias: resolucion.sugerencias, resuelto_por: 'texto', coordenadas: null };
}

function errorPunto(etiqueta, resolucion) {
  const coordenadas = resolucion.coordenadas;
  let mensaje = coordenadas
    ? `No se encontro un lugar de ClickBus cerca de las coordenadas ${coordenadas.latitud}, ${coordenadas.longitud}`
    : `No se encontro ${etiqueta} en el catalogo de ClickBus`;
  if (resolucion.fuera_de_mexico) {
    mensaje += ' (las coordenadas estan fuera de Mexico; el catalogo de ClickBus es mexicano)';
  }
  return errorHttp(422, mensaje, {
    sugerencias: resolucion.sugerencias,
    fuera_de_mexico: resolucion.fuera_de_mexico === true,
  });
}

/** En el contrato, consulta.origen/destino son texto: nombre resuelto si vinieron coordenadas. */
function nombreParaContrato(resolucion, texto) {
  if (resolucion.coordenadas || resolucion.resuelto_por === 'geocodificacion-inversa') {
    return resolucion.lugar.name;
  }
  return String(texto);
}

/**
 * Cotiza autobuses para una ruta y devuelve {cotizacion, detalle}.
 * `cotizacion` cumple el schema v1.0.0 y es importable directamente en el wizard.
 */
export async function cotizar({
  origen = null,
  destino = null,
  fecha_salida,
  fecha_regreso = null,
  personas = 1,
  con_capturas = true,
  base_url = null,
  origen_slug = null,
  destino_slug = null,
  origen_lat = null,
  origen_lng = null,
  destino_lat = null,
  destino_lng = null,
}) {
  const coordenadasOrigen = extraerCoordenadas(
    origen ?? (origen_lat != null && origen_lng != null ? { latitud: origen_lat, longitud: origen_lng } : null),
  );
  const coordenadasDestino = extraerCoordenadas(
    destino ?? (destino_lat != null && destino_lng != null ? { latitud: destino_lat, longitud: destino_lng } : null),
  );
  const textoOrigen = textoDePunto(origen) || origen_slug || textoCoordenadas(coordenadasOrigen);
  const textoDestino = textoDePunto(destino) || destino_slug || textoCoordenadas(coordenadasDestino);
  const numeroPersonas = validarConsulta({
    origen: textoOrigen,
    destino: textoDestino,
    fecha_salida,
    fecha_regreso,
    personas,
  });
  const resolucionOrigen = await resolverPunto({
    punto: origen,
    slug: origen_slug,
    coordenadas: coordenadasOrigen,
  });
  if (!resolucionOrigen.lugar) {
    throw errorPunto(
      origen_slug ? `el slug de origen "${origen_slug}"` : `el origen "${textoOrigen}"`,
      resolucionOrigen,
    );
  }
  const resolucionDestino = await resolverPunto({
    punto: destino,
    slug: destino_slug,
    coordenadas: coordenadasDestino,
  });
  if (!resolucionDestino.lugar) {
    throw errorPunto(
      destino_slug ? `el slug de destino "${destino_slug}"` : `el destino "${textoDestino}"`,
      resolucionDestino,
    );
  }

  const respuesta = await buscarViajes({
    desde: resolucionOrigen.lugar.slug,
    hasta: resolucionDestino.lugar.slug,
    fecha: fecha_salida,
    regreso: fecha_regreso || '',
  });
  const { opciones, urlCompra } = mapearOpciones(respuesta, {
    desde: resolucionOrigen.lugar.slug,
    hasta: resolucionDestino.lugar.slug,
    fecha: fecha_salida,
  });

  const advertencias = [];
  const capturas = [];
  if (con_capturas) {
    try {
      const resultado = await capturar({
        url: urlCompra,
        esperar_texto: 'Seleccionar',
        esperar_ms: 2500,
      });
      const guardado = await guardarPng(
        resultado.png,
        `clickbus-${resolucionOrigen.lugar.slug}-${resolucionDestino.lugar.slug}-${fecha_salida}`,
      );
      capturas.push({
        archivo: guardado.archivo,
        url: urlCaptura(base_url, guardado.archivo),
        bytes: guardado.bytes,
        ancho: resultado.ancho,
        alto: resultado.alto,
        ms: resultado.ms,
        titulo: resultado.titulo,
      });
      advertencias.push(...resultado.advertencias);
    } catch (error) {
      advertencias.push(`No se pudo capturar la pantalla de resultados: ${error.message}`);
    }
  }

  const consultadoEn = new Date().toISOString();
  const opcionesContrato = opciones.map((opcion) => ({
    transportista: opcion.transportista,
    modo: 'autobus',
    salida: opcion.salida_iso,
    llegada: opcion.llegada_iso,
    precio: opcion.precio,
    moneda: opcion.moneda || 'MXN',
    url_compra: opcion.url_compra,
    capturas: capturas.map((captura) => captura.url),
    fuente: 'clickbus.com.mx',
    consultado_en: consultadoEn,
  }));

  const cotizacion = {
    version: '1.0.0',
    consulta: {
      origen: nombreParaContrato(resolucionOrigen, textoOrigen),
      destino: nombreParaContrato(resolucionDestino, textoDestino),
      fecha_salida: String(fecha_salida),
      fecha_regreso: fecha_regreso ? String(fecha_regreso) : null,
      personas: numeroPersonas,
    },
    cobertura_declarada: textoCobertura({
      resolucionOrigen: resolucionOrigen.lugar,
      resolucionDestino: resolucionDestino.lugar,
      opciones,
      fechaSalida: fecha_salida,
    }),
    transportistas_no_encontrados: NO_CUBIERTOS,
    opciones: opcionesContrato,
  };

  const detalle = {
    origen: {
      slug: resolucionOrigen.lugar.slug,
      nombre: resolucionOrigen.lugar.name,
      tipo: resolucionOrigen.lugar.terminal_type,
      resuelto_por: resolucionOrigen.resuelto_por,
      coordenadas: resolucionOrigen.coordenadas,
      distancia_km: resolucionOrigen.distancia_km ?? null,
      texto_resuelto: resolucionOrigen.texto_resuelto ?? null,
    },
    destino: {
      slug: resolucionDestino.lugar.slug,
      nombre: resolucionDestino.lugar.name,
      tipo: resolucionDestino.lugar.terminal_type,
      resuelto_por: resolucionDestino.resuelto_por,
      coordenadas: resolucionDestino.coordenadas,
      distancia_km: resolucionDestino.distancia_km ?? null,
      texto_resuelto: resolucionDestino.texto_resuelto ?? null,
    },
    url_busqueda: urlCompra,
    capturas,
    advertencias,
    opciones: opciones.map((opcion) => ({
      transportista: opcion.transportista,
      clase_servicio: opcion.clase_servicio,
      salida: opcion.salida_iso,
      llegada: opcion.llegada_iso,
      duracion: opcion.duracion_texto,
      duracion_min: opcion.duracion_min,
      precio_mxn: opcion.precio,
      asientos_disponibles: opcion.asientos_disponibles,
      trip_id: opcion.trip_id,
      origen_terminal: opcion.origen_terminal,
      destino_terminal: opcion.destino_terminal,
      url_compra: opcion.url_compra,
    })),
    consultado_en: consultadoEn,
  };

  return { cotizacion, detalle };
}
