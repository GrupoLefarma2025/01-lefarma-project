/** Tipos y estilos del mapa de ruta, compartidos por el resumen y el detalle. */

export type TipoPuntoMapa = 'origen' | 'punto' | 'hotel' | 'regreso' | 'terminal';

export interface PuntoMapa {
  lat: number;
  lng: number;
  nombre: string;
  tipo: TipoPuntoMapa;
}

export type TipoSegmentoMapa = 'taxi' | 'transporte' | 'carretera';

export interface SegmentoMapa {
  tipo: TipoSegmentoMapa;
  puntos: [number, number][];
  /** Texto corto para la leyenda ("Taxi al aeropuerto"). */
  etiqueta?: string;
}

export const COLOR_POR_TIPO: Record<TipoPuntoMapa, string> = {
  origen: '#1d3a8d',
  punto: '#eb6c36',
  hotel: '#0f766e',
  regreso: '#6b7280',
  terminal: '#7c3aed',
};

export const ETIQUETA_TIPO: Record<TipoPuntoMapa, string> = {
  origen: 'Origen',
  punto: 'Punto',
  hotel: 'Hotel',
  regreso: 'Regreso',
  terminal: 'Terminal',
};

/** Estilo de cada tipo de tramo: el taxi punteado, el viaje largo sólido. */
export const ESTILO_SEGMENTO: Record<TipoSegmentoMapa, { color: string; weight: number; dashArray?: string; opacity: number }> = {
  taxi: { color: '#6b7280', weight: 3, dashArray: '6 6', opacity: 0.9 },
  transporte: { color: '#eb6c36', weight: 4, opacity: 0.95 },
  carretera: { color: '#eb6c36', weight: 4, opacity: 0.95 },
};

export const ETIQUETA_SEGMENTO: Record<TipoSegmentoMapa, string> = {
  taxi: 'Taxi',
  transporte: 'Vuelo o autobús',
  carretera: 'Carretera',
};
