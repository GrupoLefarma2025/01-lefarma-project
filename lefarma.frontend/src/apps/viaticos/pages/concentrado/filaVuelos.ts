import type { SolicitudBandeja } from '../../types/aprobaciones.types';
import type { SolicitudVuelo, TrayectoVuelo } from '../costos/ConcentradoVuelosPrint';

export const ESTADOS_CONCENTRABLES = ['enviada', 'autorizada', 'autorizada_con_ajustes'] as const;

export function esEstadoConcentrable(estado: string): boolean {
  return (ESTADOS_CONCENTRABLES as readonly string[]).includes(estado);
}

export function filaVuelos(solicitud: SolicitudBandeja): SolicitudVuelo {
  return {
    id_solicitud: solicitud.id_solicitud,
    nombre: solicitud.persona_nombre?.trim() || solicitud.nombre_solicitante,
    puesto: solicitud.puesto ?? null,
    fecha_solicitud: solicitud.fecha_creacion,
    fecha_nacimiento: solicitud.fecha_nacimiento ?? null,
    motivo: solicitud.motivo ?? null,
    trayectos: (solicitud.trayectos ?? []).slice(0, 2).map((tramo): TrayectoVuelo => ({
      fecha: tramo.fecha ?? null,
      hora: tramo.hora ?? null,
      origen: tramo.origen ?? null,
      destino: tramo.destino ?? null,
    })),
  };
}
