export const PERIODOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'esta-semana', label: 'Esta semana' },
  { value: 'esta-quincena', label: 'Esta quincena' },
  { value: 'quincena-anterior', label: 'Quincena anterior' },
  { value: 'este-mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'personalizado', label: 'Personalizado' },
] as const;

export type PeriodoValue = (typeof PERIODOS)[number]['value'];

export function toISODate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function calcularRangoPeriodo(periodo: string): { fechaInicio: string; fechaFin: string } {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = hoy.getMonth();
  const dd = hoy.getDate();
  const ultimoDiaMes = new Date(yyyy, mm + 1, 0).getDate();

  let resultado: { fechaInicio: string; fechaFin: string };

  switch (periodo) {
    case 'hoy':
      resultado = { fechaInicio: toISODate(hoy), fechaFin: toISODate(hoy) };
      break;
    case 'esta-semana': {
      const dow = hoy.getDay();
      const diff = (dow + 6) % 7;
      const inicio = new Date(yyyy, mm, dd - diff);
      const fin = new Date(yyyy, mm, dd - diff + 6);
      resultado = { fechaInicio: toISODate(inicio), fechaFin: toISODate(fin) };
      break;
    }
    case 'esta-quincena':
      if (dd <= 15) {
        resultado = {
          fechaInicio: toISODate(new Date(yyyy, mm, 1)),
          fechaFin: toISODate(new Date(yyyy, mm, 15)),
        };
      } else {
        resultado = {
          fechaInicio: toISODate(new Date(yyyy, mm, 16)),
          fechaFin: toISODate(new Date(yyyy, mm, ultimoDiaMes)),
        };
      }
      break;
    case 'quincena-anterior':
      if (dd <= 15) {
        const ultimoDiaMesAnterior = new Date(yyyy, mm, 0).getDate();
        resultado = {
          fechaInicio: toISODate(new Date(yyyy, mm - 1, 16)),
          fechaFin: toISODate(new Date(yyyy, mm - 1, ultimoDiaMesAnterior)),
        };
      } else {
        resultado = {
          fechaInicio: toISODate(new Date(yyyy, mm, 1)),
          fechaFin: toISODate(new Date(yyyy, mm, 15)),
        };
      }
      break;
    case 'este-mes':
      resultado = {
        fechaInicio: toISODate(new Date(yyyy, mm, 1)),
        fechaFin: toISODate(new Date(yyyy, mm, ultimoDiaMes)),
      };
      break;
    case 'mes-anterior': {
      const ultimoDiaMesAnterior = new Date(yyyy, mm, 0).getDate();
      resultado = {
        fechaInicio: toISODate(new Date(yyyy, mm - 1, 1)),
        fechaFin: toISODate(new Date(yyyy, mm - 1, ultimoDiaMesAnterior)),
      };
      break;
    }
    case 'personalizado':
    default:
      return { fechaInicio: '', fechaFin: '' };
  }

  const fechaFinLimite = toISODate(hoy);
  if (resultado.fechaFin > fechaFinLimite) {
    resultado.fechaFin = fechaFinLimite;
  }

  return resultado;
}
