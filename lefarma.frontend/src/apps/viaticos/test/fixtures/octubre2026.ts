export interface ViajeOctubre2026 {
  no: number;
  solicitante: string;
  fecha: string;
  origen: string;
  destino: string;
  autobus: number | null;
  avion: number | null;
  hospedaje: number | null;
  comida: number | null;
  taxi: number | null;
  total: number;
}

export const VIAJES_OCTUBRE_2026: ViajeOctubre2026[] = [
  { no: 1, solicitante: 'CESAR MARTIN GARCIA ALONSO', fecha: '2026-10-05', origen: 'CDMX', destino: 'TOLUCA', autobus: 600, avion: null, hospedaje: null, comida: 450, taxi: 1060, total: 2110 },
  { no: 2, solicitante: 'JUAN PABLO PEÑA PORTILLO', fecha: '05/10/2026 AL 09/10/2026', origen: 'CDMX', destino: 'CANCÚN PLAYA DEL CARMEN CANCÚN', autobus: 478, avion: 14963, hospedaje: 5568, comida: 2000, taxi: 3700, total: 26709 },
  { no: 3, solicitante: 'SANTIAGO GARCIA GUTIERREZ', fecha: '07/10/2026 AL 09/10/2026', origen: 'CDMX', destino: 'ORIZABA CÓRDOBA XALAPA VERACRUZ', autobus: 1748, avion: 5741, hospedaje: 2784, comida: 1350, taxi: 2750, total: 14373 },
  { no: 4, solicitante: 'CESAR MARTIN GARCIA ALONSO', fecha: '12/10/2026 AL 14/10/2026', origen: 'CDMX', destino: 'LOS MOCHIS GUASAVE CULIACÁN MAZATLÁN', autobus: 1280, avion: 8541, hospedaje: 2784, comida: 1350, taxi: 2800, total: 16755 },
  { no: 5, solicitante: 'ANGEL REMEDIOS CADENA BARRERA', fecha: '12/10/2026 AL 14/10/2026', origen: 'CDMX', destino: 'PUEBLA', autobus: 1172, avion: null, hospedaje: 2784, comida: 1100, taxi: 1500, total: 6556 },
  { no: 6, solicitante: 'JUAN PABLO PEÑA PORTILLO', fecha: '12/10/2026 AL 16/10/2026', origen: 'CDMX', destino: 'MONTERREY NUEVO LAREDO MONTERREY', autobus: null, avion: 8693, hospedaje: 5568, comida: 2250, taxi: 2000, total: 18511 },
  { no: 7, solicitante: 'ROBERTO CRUZ GUERERO', fecha: '13/10/2026 AL 16/10/2026', origen: 'CDMX', destino: 'HERMOSILLO OBREGÓN', autobus: 600, avion: 9018, hospedaje: 4176, comida: 1800, taxi: 2800, total: 18394 },
  { no: 8, solicitante: 'SANTIAGO GARCIA GUTIERREZ', fecha: '13/10/2026 AL 16/10/2026', origen: 'CDMX', destino: 'DURANGO ZACATECAS AGUACALIENTES', autobus: 1212, avion: 13912, hospedaje: 4176, comida: 1800, taxi: 3000, total: 24100 },
  { no: 9, solicitante: 'CESAR MARTIN GARCIA ALONSO', fecha: '15/10/2026 AL 16/10/2026', origen: 'CDMX', destino: 'OAXACA', autobus: null, avion: 11486, hospedaje: 1392, comida: 650, taxi: 1800, total: 15328 },
  { no: 10, solicitante: 'SANTIAGO GARCIA GUTIERREZ', fecha: '19/10/2026 AL 20/10/2026', origen: 'CDMX', destino: 'MANZANILLO COLIMA', autobus: 440, avion: 8781, hospedaje: 1392, comida: 900, taxi: 2500, total: 14013 },
  { no: 11, solicitante: 'JUAN PABLO PEÑA PORTILLO', fecha: '19/10/2026 AL  23/10/2026', origen: 'CDMX', destino: 'VERACRUZ CARDEL VERACRUZ CÓRDOBA XALAPA', autobus: 1824, avion: 5772, hospedaje: 5568, comida: 2000, taxi: 2700, total: 17864 },
  { no: 12, solicitante: 'CESAR MARTIN GARCIA ALONSO', fecha: '20/10/2026 AL 21/10/2026', origen: 'CDMX', destino: 'TAMPICO', autobus: null, avion: 8629, hospedaje: 1392, comida: 900, taxi: 2000, total: 12921 },
  { no: 13, solicitante: 'SANTIAGO GARCIA GUTIERREZ', fecha: '22/10/2026 AL 23/10/2026', origen: 'CDMX', destino: 'ZITÁCUARO MORELIA', autobus: 1602, avion: null, hospedaje: 1392, comida: 900, taxi: 2000, total: 5894 },
  { no: 14, solicitante: 'ROBERTO CRUZ GUERERO', fecha: '2026-10-23', origen: 'CDMX', destino: 'CUERNAVACA', autobus: 700, avion: null, hospedaje: null, comida: 450, taxi: 1040, total: 2190 },
  { no: 15, solicitante: 'ANGEL REMEDIOS CADENA BARRERA', fecha: '2026-10-26', origen: 'CDMX', destino: 'PACHUCA', autobus: 440, avion: null, hospedaje: null, comida: 450, taxi: 1200, total: 2090 },
  { no: 16, solicitante: 'CESAR MARTIN GARCIA ALONSO', fecha: '26/10/2026 AL  27/10/2026', origen: 'CDMX', destino: 'VILLAHERMOSA TUXTLA', autobus: 933, avion: 10074, hospedaje: 1392, comida: 900, taxi: 2000, total: 15299 },
  { no: 17, solicitante: 'JUAN PABLO PEÑA PORTILLO', fecha: '26/10/2026 AL 30/10/2026', origen: 'CDMX', destino: 'MONTERREY CD. VICTORIA MONCLOVA MONTERREY', autobus: null, avion: 11971, hospedaje: 5568, comida: 2250, taxi: 2600, total: 22389 },
  { no: 18, solicitante: 'ROBERTO CRUZ GUERERO', fecha: '27/10/2026 AL  28/10/2026', origen: 'CDMX', destino: 'METEPEC ATLACOMULCO TOLUCA', autobus: 1240, avion: null, hospedaje: 1392, comida: 900, taxi: 1700, total: 5232 },
  { no: 19, solicitante: 'SANTIAGO GARCIA GUTIERREZ', fecha: '27/10/2026 AL 30/10/2026', origen: 'CDMX', destino: 'TIJUANA MEXICALI', autobus: 700, avion: 13912, hospedaje: 4176, comida: 1800, taxi: 3300, total: 23888 },
  { no: 20, solicitante: 'CESAR MARTIN GARCIA ALONSO', fecha: '29/10/2026 AL  30/10/2026', origen: 'CDMX', destino: 'VERACRUZ XALAPA', autobus: 1512, avion: 6137, hospedaje: 1392, comida: 900, taxi: 1800, total: 11741 },
];

export const TOTALES_OCTUBRE_2026 = {
  autobus: 16481,
  avion: 137630,
  hospedaje: 52896,
  comida: 25100,
  taxi: 44250,
  total: 276357,
} as const;

export function sumaCategoria(
  viajes: ViajeOctubre2026[],
  categoria: 'autobus' | 'avion' | 'hospedaje' | 'comida' | 'taxi',
): number {
  return viajes.reduce((suma, viaje) => suma + (viaje[categoria] ?? 0), 0);
}

export function sumaCategorias(viaje: ViajeOctubre2026): number {
  return (
    (viaje.autobus ?? 0) +
    (viaje.avion ?? 0) +
    (viaje.hospedaje ?? 0) +
    (viaje.comida ?? 0) +
    (viaje.taxi ?? 0)
  );
}
