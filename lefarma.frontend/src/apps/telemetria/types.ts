/**
 * Tipos de la API de telemetría. Reflejan los DTO del backend
 * (`Features/Telemetria/Consulta/ConsultaDtos.cs`) y se serializan en camelCase.
 */

export interface HuellaErrorResumen {
  huella: string;
  tipoError: string;
  mensaje: string;
  ruta: string;
  ocurrencias: number;
  usuariosAfectados: number;
  primeraVez: string;
  ultimaVez: string;
}

export interface OcurrenciaError {
  recibidoEn: string;
  ocurridoEn: string;
  mensaje: string;
  stack: string | null;
  ruta: string;
  navegador: string | null;
  usuarioHash: string | null;
  estadoHttp: number | null;
  requestId: string | null;
  entorno: string | null;
}

export interface BotonResumen {
  ruta: string;
  elemento: string;
  etiqueta: string | null;
  clics: number;
  usuariosUnicos: number;
  clicsDeEnojo: number;
  ultimoClic: string;
}

export interface MapaCalorResumen {
  ruta: string;
  columnas: number;
  filas: number;
  tamanoCelda: number;
  totalMovimientos: number;
  visitas: number;
  celdas: number[];
}

export interface RutaResumen {
  ruta: string;
  clics: number;
  errores: number;
  visitas: number;
}

export interface ErrorServidorResumen {
  id: number;
  fechaError: string;
  severidad: string;
  tipoExcepcion: string;
  mensajeError: string;
  rutaEndpoint: string | null;
  metodoHttp: string | null;
  statusCode: number | null;
  nombreUsuario: string | null;
  durationMs: number | null;
  requestId: string | null;
}

export interface PaginaErrorServidor {
  total: number;
  pagina: number;
  tamano: number;
  elementos: ErrorServidorResumen[];
}

export interface ResumenTelemetria {
  erroresHoy: number;
  erroresPeriodo: number;
  clicsPeriodo: number;
  visitasPeriodo: number;
  eventosDescartados: number;
  topErrores: HuellaErrorResumen[];
  topBotones: BotonResumen[];
}

export interface EstadoAlmacen {
  habilitada: boolean;
  disponible: boolean;
  destino: string;
  error: string | null;
  tablas: Record<string, number>;
}

export interface EstadoTelemetria {
  almacen: EstadoAlmacen;
  cola: { encolados: number; descartados: number; pendientes: number; capacidad: number };
  escritor: {
    lotesEscritos: number;
    eventosEscritos: number;
    lotesRepetidos: number;
    eventosFallidos: number;
    ultimoError: string | null;
    ultimoVaciado: string | null;
    ultimaRetencion: string | null;
    ultimaRetencionDetalle: string | null;
  };
  consultadoEn: string;
}

/** Filtro de fechas disponible en todas las pestañas. */
export interface RangoFechas {
  desde: Date;
  hasta: Date;
}
