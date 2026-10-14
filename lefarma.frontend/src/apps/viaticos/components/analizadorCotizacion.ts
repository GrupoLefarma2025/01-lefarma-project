import { esquemaCotizacionViajes } from '../schemas/cotizacionViajes.esquema';
import type {
  ConceptosMotor,
  Cotizacion,
  CotizacionOpcion,
  DesgloseViaticos,
  FilaCotizacion,
} from '../types/cotizacion.types';
import type { OpcionCotizacion } from '../types/solicitud.types';
import { validarCotizacion } from './validadorCotizacion';

/** Resultado de intentar cargar el JSON pegado: o la tabla, o los errores. */
export type ResultadoCotizacion =
  | { valido: true; cotizacion: Cotizacion; filas: FilaCotizacion[] }
  | { valido: false; errores: string[] };

const claveDe = (opcion: CotizacionOpcion, indice: number): string =>
  `${indice}-${opcion.modo}-${opcion.transportista}`;

/**
 * Parsea, valida contra el contrato y mapea a filas de tabla. No muta nada:
 * si algo falla devuelve los errores y el llamador deja el estado como estaba.
 * url_compra y capturas[] se copian tal cual (referencias intactas).
 */
export function analizarCotizacion(texto: string): ResultadoCotizacion {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    return { valido: false, errores: [`El JSON pegado no se pudo interpretar: ${detalle}`] };
  }

  const validacion = validarCotizacion(datos, esquemaCotizacionViajes);
  if (!validacion.valido) {
    return { valido: false, errores: validacion.errores };
  }

  const cotizacion = datos as Cotizacion;
  const filas = cotizacion.opciones.map((opcion, indice) => ({
    clave: claveDe(opcion, indice),
    modo: opcion.modo,
    transportista: opcion.transportista,
    salida: opcion.salida,
    llegada: opcion.llegada,
    precio: opcion.precio,
    moneda: opcion.moneda ?? 'MXN',
    url_compra: opcion.url_compra,
    capturas: opcion.capturas ?? [],
    fuente: opcion.fuente,
    estimado: opcion.precio === null,
    seleccionada: false,
  }));
  return { valido: true, cotizacion, filas };
}

/**
 * Construye el body de PUT /viaticos/solicitudes/{id}/opciones. Se envian TODAS
 * las opciones de la cotización, no solo las elegidas: el backend reemplaza el
 * juego completo y marca cada una con fue_elegida.
 */
export function opcionesParaEnvio(filas: FilaCotizacion[]): OpcionCotizacion[] {
  return filas.map(fila => ({
    tipo: fila.modo === 'hotel' ? 'hotel' : 'vuelo',
    linea: fila.transportista,
    precio: fila.precio,
    moneda: fila.moneda,
    url_compra: fila.url_compra,
    fuente: fila.fuente,
    fue_elegida: fila.seleccionada,
    ruta_captura: fila.capturas[0] ?? null,
    capturas: fila.capturas,
  }));
}

/**
 * Construye el desglose por concepto que se persiste en `datos_json` al
 * enviar. Las columnas avion/autobus/hospedaje salen de las filas de la
 * cotizacion de pi marcadas como elegidas: el backend guarda todas las
 * opciones como `vuelo` salvo hotel (ver `opcionesParaEnvio`), asi que la
 * distincion avion/autobus solo existe en el frontend y hay que persistirla.
 * Gasolina, casetas, comida y taxi vienen del motor de costos de ruta, que solo
 * el wizard conoce porque el motor lo calcula en memoria. El hospedaje tambien
 * puede venir del motor (tarifa tabulador del pernocte) pero solo como
 * respaldo: un hotel cotizado y elegido de pi es el precio real y manda.
 *
 * Regla dura del proyecto: `null` = "no se sabe" y 0 = "costo cero". Un modo
 * sin filas elegidas, o con alguna elegida sin precio, da `null`: JAMAS se
 * cuenta como 0. Un concepto del motor que no llego tambien queda `null`. El
 * total suma solo los conceptos conocidos; si ninguno lo es, tambien es `null`
 * (no un $0.00 inventado).
 */
export function desgloseConceptos(
  filas: FilaCotizacion[],
  conceptosMotor: ConceptosMotor | null = null,
): DesgloseViaticos {
  const sumaElegidas = (modo: FilaCotizacion['modo']): number | null => {
    const elegidas = filas.filter(fila => fila.modo === modo && fila.seleccionada);
    if (elegidas.length === 0) return null;
    // Una fila elegida sin precio deja el concepto entero desconocido: sumar
    // solo las conocidas subestimaria un total de dinero.
    if (elegidas.some(fila => fila.precio === null)) return null;
    return elegidas.reduce((suma, fila) => suma + (fila.precio as number), 0);
  };

  const desglose = {
    autobus: sumaElegidas('autobus'),
    avion: sumaElegidas('avion'),
    // El hotel cotizado y elegido de pi manda (precio real); si no hay ninguno,
    // el respaldo es la tarifa tabulador del motor. Nunca se suman ambos.
    hospedaje: sumaElegidas('hotel') ?? conceptosMotor?.hospedaje ?? null,
    gasolina: conceptosMotor?.gasolina ?? null,
    casetas: conceptosMotor?.casetas ?? null,
    comida: conceptosMotor?.comida ?? null,
    taxi: conceptosMotor?.taxi ?? null,
  };

  const conocidos = Object.values(desglose).filter(
    (valor): valor is number => valor !== null,
  );
  return {
    ...desglose,
    total: conocidos.length > 0 ? conocidos.reduce((suma, valor) => suma + valor, 0) : null,
  };
}

/** Texto del precio para la tabla: null se muestra como estimado, nunca como 0. */
export function textoPrecio(
  fila: Pick<FilaCotizacion, 'precio' | 'moneda' | 'fuente'>,
): string {
  if (fila.precio === null) return `Estimado (${fila.fuente})`;
  return `${fila.precio.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${fila.moneda}`;
}