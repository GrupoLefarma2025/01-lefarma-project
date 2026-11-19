import type { SolicitudBandeja } from '../../types/aprobaciones.types';
import type { SolicitudVuelo, TrayectoVuelo } from '../costos/ConcentradoVuelosPrint';

/**
 * Piezas del concentrado («Solicitud de avión» y FOR-008): qué solicitudes se
 * pueden marcar para el documento y cómo se mapea una fila de la bandeja al
 * de vuelos. Viven fuera de los componentes para no mezclar helpers con el
 * render (regla de Fast Refresh).
 */

/**
 * Estados que se pueden marcar para el concentrado: todo lo que ya salió del
 * borrador. El documento se arma y se revisa ANTES de autorizar —el de vuelos
 * se manda a la agencia incluso antes—, así que una enviada se marca; un
 * borrador o una rechazada no se concentran.
 */
export const ESTADOS_CONCENTRABLES = ['enviada', 'autorizada', 'autorizada_con_ajustes'] as const;

export function esEstadoConcentrable(estado: string): boolean {
  return (ESTADOS_CONCENTRABLES as readonly string[]).includes(estado);
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
