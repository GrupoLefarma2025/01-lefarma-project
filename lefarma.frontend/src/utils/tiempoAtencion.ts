/**
 * Cálculo de tiempo de atención para las órdenes de compra.
 *
 * El tiempo real es la diferencia natural entre dos fechas. El tiempo laboral
 * solo considera los minutos que caen dentro del horario de oficina:
 * lunes a viernes de 8:00 a 18:30.
 */

export const HORARIO_LABORAL = {
  horaInicio: 8,
  minutoInicio: 0,
  horaFin: 18,
  minutoFin: 30,
} as const;

export interface TiempoAtencion {
  realMs: number;
  laboralMs: number;
}

const esDiaLaboral = (fecha: Date): boolean => {
  const dia = fecha.getDay();
  return dia >= 1 && dia <= 5;
};

const inicioJornada = (fecha: Date): Date =>
  new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    HORARIO_LABORAL.horaInicio,
    HORARIO_LABORAL.minutoInicio,
    0,
    0
  );

const finJornada = (fecha: Date): Date =>
  new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    HORARIO_LABORAL.horaFin,
    HORARIO_LABORAL.minutoFin,
    0,
    0
  );

/** Milisegundos transcurridos dentro del horario laboral (L-V, 8:00-18:30). */
export function calcularTiempoLaboralMs(desde: Date, hasta: Date): number {
  if (
    Number.isNaN(desde.getTime()) ||
    Number.isNaN(hasta.getTime()) ||
    hasta.getTime() <= desde.getTime()
  ) {
    return 0;
  }

  let total = 0;
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const ultimoDia = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());

  while (cursor.getTime() <= ultimoDia.getTime()) {
    if (esDiaLaboral(cursor)) {
      const inicio = inicioJornada(cursor);
      const fin = finJornada(cursor);
      const desdeEfectivo = desde.getTime() > inicio.getTime() ? desde : inicio;
      const hastaEfectivo = hasta.getTime() < fin.getTime() ? hasta : fin;

      if (hastaEfectivo.getTime() > desdeEfectivo.getTime()) {
        total += hastaEfectivo.getTime() - desdeEfectivo.getTime();
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export function calcularTiempoAtencion(desde: Date, hasta: Date): TiempoAtencion {
  if (
    Number.isNaN(desde.getTime()) ||
    Number.isNaN(hasta.getTime()) ||
    hasta.getTime() <= desde.getTime()
  ) {
    return { realMs: 0, laboralMs: 0 };
  }

  return {
    realMs: hasta.getTime() - desde.getTime(),
    laboralMs: calcularTiempoLaboralMs(desde, hasta),
  };
}

/**
 * Formatea una duración en días, horas, minutos y, opcionalmente, segundos.
 * Ejemplos: "2 min", "1 h 5 min", "2 d 13 h 32 min".
 */
export function formatDuracion(ms: number, conSegundos = false): string {
  const totalSegundos = Math.max(0, Math.floor((Number.isNaN(ms) ? 0 : ms) / 1000));
  const dias = Math.floor(totalSegundos / 86_400);
  const horas = Math.floor((totalSegundos % 86_400) / 3_600);
  const minutos = Math.floor((totalSegundos % 3_600) / 60);
  const segundos = totalSegundos % 60;

  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias} d`);
  if (horas > 0) partes.push(`${horas} h`);
  if (minutos > 0) partes.push(`${minutos} min`);
  if (conSegundos && segundos > 0) partes.push(`${segundos} s`);

  if (partes.length === 0) return conSegundos ? '0 s' : '0 min';
  return partes.join(' ');
}
