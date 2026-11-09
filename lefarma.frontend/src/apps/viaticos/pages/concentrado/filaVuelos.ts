import type { SolicitudBandeja } from '../../types/aprobaciones.types';
import type { SolicitudVuelo, TrayectoVuelo } from '../costos/ConcentradoVuelosPrint';

/**
 * Piezas del concentrado de VUELOS («Solicitud de avión»): qué solicitudes se
 * pueden mandar a la agencia y cómo se mapea una fila de la bandeja al
 * documento. Viven fuera de los componentes para no mezclar helpers con el
 * render (regla de Fast Refresh).
 */

/**
 * Estados elegibles para el concentrado de vuelos: la solicitud que se manda a
 * la agencia existe antes de la autorización, así que además de las autorizadas
 * se pueden marcar las enviadas. Un borrador o una rechazada no se envían.
 */
export const ESTADOS_VUELOS = ['enviada', 'autorizada', 'autorizada_con_ajustes'] as const;

export function esEstadoVuelos(estado: string): boolean {
  return (ESTADOS_VUELOS as readonly string[]).includes(estado);
}

/**
 * MAPEO bandeja -> fila del concentrado de vuelos.
 *
 * Toma del servidor lo que ya resolvió (persona que viaja, puesto, fecha de
 * nacimiento e itinerario) y NO inventa lo que falta: un campo ausente queda
 * `null` y el documento lo imprime como "—". El nombre cae al del directorio
 * solo cuando el snapshot no trae a la persona que viaja.
 */
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
