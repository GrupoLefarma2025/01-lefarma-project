import type { SolicitudOpcion } from '../types/solicitud.types';

export function nombreCortoOpcion(opcion: SolicitudOpcion): string {
  const linea = (opcion.linea ?? '').trim();
  if ((opcion.tipo ?? '').trim().toLowerCase() !== 'taxi') return linea;

  const iataDe = (valor: unknown): string | null => {
    if (typeof valor !== 'string') return null;
    return /\(([A-Z]{3})\)/.exec(valor)?.[1] ?? null;
  };
  const iataOrigen = iataDe(opcion.datos?.terminal_origen);
  const iataDestino = iataDe(opcion.datos?.terminal_destino);

  if (iataOrigen && iataDestino && iataOrigen !== iataDestino) {
    return `Taxi ${iataOrigen} ↔ ${iataDestino}`;
  }

  const iatas = [...linea.matchAll(/\(([A-Z]{3})\)/g)].map((coincidencia) => coincidencia[1]);
  const [primerIata, segundoIata] = iatas;
  if (primerIata && segundoIata && primerIata !== segundoIata) {
    return `Taxi ${primerIata} ↔ ${segundoIata}`;
  }

  const sinDetalle = linea.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return sinDetalle || 'Taxi';
}
