/** Punto capturado manualmente (mapa, búsqueda global o selector guiado). */
export interface PuntoSeleccion {
  nombre: string;
  latitud: number;
  longitud: number;
  /** Estado/municipio de la dirección elegida, cuando se conocen (búsqueda). */
  estado?: string;
  municipio?: string;
}

export interface CostosRutaOpciones {
  respetarHorarioLaboral: boolean;
  calcularHoteles: boolean;
  calcularViajesIntermedios: boolean;
  compartirViaje: boolean;
}

export interface CostosRutaRequest {
  opciones: CostosRutaOpciones;
  personas: CostosRutaPersonaInput[];
}

export interface CostosRutaPersonaInput {
  nombre: string;
  carro_propio: boolean;
  gasolina: 'magna' | 'premium';
  draft: boolean;
  trabajo: {
    hora_entrada: string;
    hora_salida: string;
    primer_dia_laboral: number;
    ultimo_dia_laboral: number;
  };
  lugares: CostosRutaLugarInput[];
}

export interface CostosRutaLugarInput {
  orden: number;
  tipo: 'salida' | 'taller' | 'punto' | 'hotel';
  nombre: string;
  latitud: number;
  longitud: number;
  /** Municipio del punto: el motor lo usa para consultar la ruta en la SCT. */
  municipio?: string;
  /** Estado del punto (idem). */
  estado?: string;
  fecha_salida?: string;
  hora_salida?: string;
  fecha_llegada?: string;
  hora_llegada?: string;
  fecha_limite_llegada?: string;
  hora_limite_llegada?: string;
  fecha_inicio_actividad?: string;
  hora_inicio_actividad?: string;
  fecha_fin_actividad?: string;
  hora_fin_actividad?: string;
}

export interface CostosRutaCompra {
  url: string;
  sitio: string;
  accion: string;
  objetivo: string;
  fecha: string;
}

export interface CostosRutaOferta {
  id: string;
  modo: string;
  linea: string;
  servicio: string;
  persona: string;
  tramo: number | null;
  de: string | null;
  a: string | null;
  salidaTxt: string;
  llegadaTxt: string;
  /** Salida y llegada en ISO que expone el motor (pueden venir vacías). */
  salida?: string | null;
  llegada?: string | null;
  duracion: string;
  puertaAPuertaH: number | null;
  /** Minutos antes de la salida (aeropuerto/abordaje). */
  minutosAntes?: number;
  /** Minutos después de la llegada (bajar del avión y recoger maletas). */
  minutosDespues?: number;
  /** Minutos estimados del taxi a la terminal (bus o avión). */
  minutosTaxi?: number;
  precioTxt: string;
  porPersona: boolean;
  costoGrupo: number;
  costoPorPersona: number;
  aTiempo: boolean;
  llegaTarde: boolean;
  minutosTarde: number;
  noTomable: boolean;
  badge: string;
  nota: string;
  fuente: string;
  estimado: boolean;
  comprar: CostosRutaCompra;
  /** Ruta del PNG capturado (columna `ruta_captura` de solicitud_opciones). */
  rutaCaptura?: string;
  /** Capturas del JSON de cotizacion de pi (URL o data URI); se usa la primera. */
  capturas?: string[];
}

export interface CostosRutaPropuestaTramo {
  tramo: number;
  de: string;
  a: string;
  modo: string;
  linea: string;
  salida: string;
  llegada: string;
  costo: number;
}

export interface CostosRutaHotel {
  lugar: string;
  nombre?: string;
  ciudad: string;
  checkIn: string;
  checkOut: string;
  noches: number;
  habitaciones: number;
  distanciaKm?: number;
  precioNoche?: number;
  precioTotal?: number;
  /** Calificación y reseñas (Google Places). */
  rating?: number | null;
  ratingCount?: number | null;
  direccion?: string | null;
  /** Coordenadas del hotel (para el mapa de la ruta reconstruida). */
  latitud?: number;
  longitud?: number;
  motivo: string;
  fuente: string;
  link: string;
  /** Ruta del PNG capturado (columna `ruta_captura` de solicitud_opciones). */
  rutaCaptura?: string;
  /** Capturas del JSON de cotizacion de pi (URL o data URI); se usa la primera. */
  capturas?: string[];
}

export interface CostosRutaPropuesta {
  persona: string;
  clave: string;
  titulo: string;
  cumpleTodos: boolean;
  salidaOrigen: string;
  llegadaFinal: string;
  margenMinimoMinutos: number;
  costoTotalMxn: number;
  // Componentes del costo ya sumados dentro de costoTotalMxn; el motor los
  // expone tal cual (backend CostosRutaDtos.cs) y no se recalculan aqui.
  comida: number;
  taxi: number;
  hospedaje: number;
  tramos: CostosRutaPropuestaTramo[];
  hotelesPropuestos: CostosRutaHotel[];
  incumplimientos: string[];
  fuentes: string[];
}

export interface CostosRutaRutaTramo {
  de: string;
  a: string;
  km: number;
  /** Trazado de la carretera: pares [latitud, longitud]. */
  grafica?: number[][];
  litros: number;
  gasolina: {
    magna: { precioL: number; costo: number; fuente: string };
    premium: { precioL: number; costo: number; fuente: string };
  };
  casetas: { costo: number; fuente: string };
  subtotalMagna: number;
  subtotalPremium: number;
}

export interface CostosRutaCaseta {
  tramo: number;
  /** Municipio de origen del tramo (para emparejar con el tramo del viaje). */
  deMunicipio?: string;
  /** Municipio de destino del tramo. */
  aMunicipio?: string;
  nombre: string;
  carretera: string;
  /** Kilómetro desde el origen donde está la plaza (SCT). */
  km: number;
  /** Tarifa de automóvil en pesos (SCT). */
  tarifa: number;
  direccion: string;
  fuente: string;
}

export interface CostosRutaResultado {
  nombre: string;
  gasolina: string;
  propuesta: { razones: string[]; lugares: unknown[] };
  tramos: { from: string; to: string; km: number; opciones: CostosRutaOferta[] }[];
  rutaArmada: {
    tramos: CostosRutaRutaTramo[];
    totales: {
      km: number;
      litros: number;
      casetas: number;
      subtotalMagna: number;
      subtotalPremium: number;
    };
  };
  hotelesPropuestos: CostosRutaHotel[];
  incumplimientos: string[];
  /** Casetas de la ruta según la SCT (plaza, km, carretera y tarifa de auto). */
  casetas?: CostosRutaCaseta[];
}

export interface CostosRutaCompartido {
  de: string;
  a: string;
  personas: string[];
  conductor: string | null;
  ahorroEstimadoMxn: number;
  nota: string;
}

export interface CostosRutaResponse {
  resultados: CostosRutaResultado[];
  propuestas: CostosRutaPropuesta[];
  categorias: Record<string, CostosRutaOferta[]>;
  recomendaciones: {
    persona: string;
    tramo: number;
    de: string;
    a: string;
    km: number;
    razon: string;
    mejorOfertaId: string;
  }[];
  compartidos: CostosRutaCompartido[];
}
