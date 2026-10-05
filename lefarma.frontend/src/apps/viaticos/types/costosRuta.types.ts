/** Punto capturado manualmente (mapa, búsqueda global o selector guiado). */
export interface PuntoSeleccion {
  nombre: string;
  latitud: number;
  longitud: number;
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
  duracion: string;
  puertaAPuertaH: number | null;
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
  ciudad: string;
  checkIn: string;
  checkOut: string;
  noches: number;
  habitaciones: number;
  motivo: string;
  fuente: string;
  link: string;
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
  tramos: CostosRutaPropuestaTramo[];
  hotelesPropuestos: CostosRutaHotel[];
  incumplimientos: string[];
  fuentes: string[];
}

export interface CostosRutaRutaTramo {
  de: string;
  a: string;
  km: number;
  litros: number;
  gasolina: {
    magna: { precioL: number; costo: number; fuente: string };
    premium: { precioL: number; costo: number; fuente: string };
  };
  casetas: { costo: number; fuente: string };
  subtotalMagna: number;
  subtotalPremium: number;
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
