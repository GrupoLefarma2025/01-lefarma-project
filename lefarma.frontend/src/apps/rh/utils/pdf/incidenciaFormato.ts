/** Normaliza texto para comparar etiquetas del formato con los nombres de tipo de la BD. */
export function normalize(text?: string | null) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Parte una fecha ISO en DÍA/MES/AÑO sin corrimiento de zona horaria. */
export function splitFechaISO(fecha?: string | null): { d: string; m: string; y: string } {
  if (!fecha) return { d: '', m: '', y: '' };
  const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (mt) return { y: mt[1], m: mt[2], d: mt[3] };
  const dt = new Date(fecha);
  if (isNaN(dt.getTime())) return { d: '', m: '', y: '' };
  return {
    y: String(dt.getFullYear()),
    m: String(dt.getMonth() + 1).padStart(2, '0'),
    d: String(dt.getDate()).padStart(2, '0'),
  };
}

// ponytail: match() covers BOTH the printed-form label and the real DB tipo names
// (e.g. DB "Retardo mayor a 20 minutos" must tick the form's "Retardo de mas de 20 minutos",
// and "Retardo menor..." must tick "Retardo de menos..."). Keyword-only matching missed these.
export const INCIDENCIA_OPCIONES: { label: string; match: (t: string) => boolean }[] = [
  { label: 'Omisión de checado entrada o salida', match: (t) => t.includes('omision') },
  {
    label: 'Retardo de menos de 20 minutos',
    match: (t) => t.includes('retardo') && (t.includes('menor') || t.includes('menos')),
  },
  {
    label: 'Retardo de mas de 20 minutos',
    match: (t) => t.includes('retardo') && (t.includes('mayor') || t.includes('mas')),
  },
];

export const PERMISO_OPCIONES: { label: string; match: (t: string) => boolean }[] = [
  { label: 'Llegar tarde sin reposición de tiempo:', match: (t) => t.includes('llegar') && t.includes('sin reposicion') },
  { label: 'Llegar tarde con reposición de tiempo:', match: (t) => t.includes('llegar') && t.includes('con reposicion') },
  { label: 'Salida temprano sin reposición de tiempo', match: (t) => t.includes('salida') && t.includes('sin reposicion') },
  { label: 'Salida temprano con reposición de tiempo', match: (t) => t.includes('salida') && t.includes('con reposicion') },
  { label: 'Permiso de día sin goce de sueldo', match: (t) => t.includes('goce') },
  { label: 'Comisión de trabajo', match: (t) => t.includes('comision') },
];

export const NOTES = [
  '1- Si el empleado solicita tiempo a cuenta de vacaciones se debe llenar el formato "Solicitud de vacaciones".',
  '2- Si el empleado va a comisión de trabajo, en el apartado "Lugar de comisión" deberá requisitarse el lugar en el que se hará la comisión',
  '3- En el apartado "Descripción / Motivo / Incidencia o Permiso" se detallarán los motivos por los cuales se solicitará la incidencia.',
  '4- Si el empleado requiere permiso día con goce de sueldo, hará uso de un formato llamado "Solicitud de día con goce de sueldo"',
  'el cual requerirá aprobación de Dirección Corporativa.',
];

/** Índices (0-based) de la opción marcada; -1 si ninguna. fillRepos: fila de la rejilla de reposición. */
export function indicesIncidencia(tipoNombre?: string | null) {
  const t = normalize(tipoNombre);
  const idxJust = INCIDENCIA_OPCIONES.findIndex((o) => o.match(t));
  const idxPerm = PERMISO_OPCIONES.findIndex((o) => o.match(t));
  const fillRepos = idxPerm === 1 ? 1 : idxPerm === 3 ? 2 : 0;
  return { idxJust, idxPerm, fillRepos };
}
