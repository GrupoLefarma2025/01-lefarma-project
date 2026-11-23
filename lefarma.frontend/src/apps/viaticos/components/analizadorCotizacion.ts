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

export type ResultadoCotizacion =
  | { valido: true; cotizacion: Cotizacion; filas: FilaCotizacion[] }
  | { valido: false; errores: string[] };

const claveDe = (opcion: CotizacionOpcion, indice: number): string =>
  `${indice}-${opcion.modo}-${opcion.transportista}`;

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

export function opcionesParaEnvio(filas: FilaCotizacion[]): OpcionCotizacion[] {
  return filas.map(fila => ({
    tipo: fila.modo === 'hotel' ? 'hotel' : fila.modo === 'autobus' ? 'autobus' : 'vuelo',
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

export function desgloseConceptos(
  filas: FilaCotizacion[],
  conceptosMotor: ConceptosMotor | null = null,
): DesgloseViaticos {
  const sumaElegidas = (modo: FilaCotizacion['modo']): number | null => {
    const elegidas = filas.filter(fila => fila.modo === modo && fila.seleccionada);
    if (elegidas.length === 0) return null;
    if (elegidas.some(fila => fila.precio === null)) return null;
    return elegidas.reduce((suma, fila) => suma + (fila.precio as number), 0);
  };

  const desglose = {
    autobus: sumaElegidas('autobus'),
    avion: sumaElegidas('avion'),
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

export function textoPrecio(
  fila: Pick<FilaCotizacion, 'precio' | 'moneda' | 'fuente'>,
): string {
  if (fila.precio === null) return `Estimado (${fila.fuente})`;
  return `${fila.precio.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${fila.moneda}`;
}