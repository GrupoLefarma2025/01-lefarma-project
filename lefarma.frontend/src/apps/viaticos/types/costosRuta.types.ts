export interface PuntoSeleccion {
  nombre: string;
  latitud: number;
  longitud: number;
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
  municipio?: string;
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

export interface CostosRutaTerminal {
  nombre: string;
  latitud: number;
  longitud: number;
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
  salida?: string | null;
  llegada?: string | null;
  duracion: string;
  puertaAPuertaH: number | null;
  minutosAntes?: number;
  minutosDespues?: number;
  minutosTaxi?: number;
  minutosTaxiOrigen?: number | null;
  minutosTaxiDestino?: number | null;
  terminalOrigen?: CostosRutaTerminal | null;
  terminalDestino?: CostosRutaTerminal | null;
  precioTxt: string;
  porPersona: boolean;
  costoGrupo: number;
  costoPorPersona: number;
  costoTaxi?: number;
  costoTaxiOrigen?: number;
  costoTaxiDestino?: number;
  aTiempo: boolean;
  llegaTarde: boolean;
  minutosTarde: number;
  noTomable: boolean;
  badge: string;
  nota: string;
  fuente: string;
  estimado: boolean;
  tipoPrecio?: string;
  proveedor?: string;
  disponibilidad?: string;
  disponibilidadDetalle?: string;
  combustible?: number | null;
  comprar: CostosRutaCompra;
  rutaCaptura?: string;
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
  rating?: number | null;
  ratingCount?: number | null;
  direccion?: string | null;
  latitud?: number;
  longitud?: number;
  motivo: string;
  fuente: string;
  tipoPrecio?: string;
  proveedor?: string;
  disponibilidad?: string;
  disponibilidadDetalle?: string;
  link: string;
  linkMapa?: string | null;
  linkReserva?: string | null;
  rutaCaptura?: string;
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
  grafica?: number[][];
  litros: number;
  gasolina: {
    magna: { precioL: number; costo: number; fuente: string };
    premium: { precioL: number; costo: number; fuente: string };
  };
  subtotalMagna: number;
  subtotalPremium: number;
}

export interface CostosRutaCaseta {
  tramo: number;
  deMunicipio?: string;
  aMunicipio?: string;
  nombre: string;
  carretera: string;
  km: number;
  tarifa: number;
  direccion: string;
  fuente: string;
}

export type EstadoCasetasSct =
  | 'disponible'
  | 'destino_no_soportado'
  | 'proveedor_no_disponible'
  | 'respuesta_invalida';

export interface CostosRutaCasetaDisponibilidad {
  tramo: number;
  deMunicipio?: string;
  aMunicipio?: string;
  estado: EstadoCasetasSct;
  kmTotal: number | null;
  tiempoTotal: string | null;
  peajeTotal: number | null;
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
      subtotalMagna: number;
      subtotalPremium: number;
    };
  };
  hotelesPropuestos: CostosRutaHotel[];
  incumplimientos: string[];
  casetas?: CostosRutaCaseta[];
  casetasDisponibilidad?: CostosRutaCasetaDisponibilidad[];
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
