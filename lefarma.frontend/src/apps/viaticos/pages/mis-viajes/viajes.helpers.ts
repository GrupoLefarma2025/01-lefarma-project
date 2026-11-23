import type { OpcionCotizacion, Solicitud, SolicitudOpcion } from '../../types/solicitud.types';

export type TipoViaje = 'propio' | 'solicitado' | 'sin-clasificar';

export interface ResumenViaje {
  destino: string | null;
  tipoViaje: TipoViaje;
  beneficiarioId: number | null;
  beneficiarioNombre: string | null;
  compartidoConIds: number[];
  compartidoPor: string | null;
}

function comoObjeto(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
}

export function leerDatosViaje(datos: unknown): ResumenViaje {
  const base: ResumenViaje = {
    destino: null,
    tipoViaje: 'sin-clasificar',
    beneficiarioId: null,
    beneficiarioNombre: null,
    compartidoConIds: [],
    compartidoPor: null,
  };
  const d = comoObjeto(datos);
  if (!d) return base;

  const destinoDirecto = typeof d.destino === 'string' && d.destino.trim() !== '' ? d.destino.trim() : null;
  const destinos = Array.isArray(d.destinos) ? d.destinos : [];
  const primerPunto = comoObjeto(destinos[0])?.punto;
  const destinoPunto =
    (comoObjeto(primerPunto)?.nombre as string | undefined)?.trim() ||
    ((comoObjeto(destinos[0])?.nombre as string | undefined)?.trim() ?? null);
  base.destino = destinoDirecto ?? destinoPunto ?? null;

  const transporte = comoObjeto(d.transporte);
  const modo = transporte?.modo ?? d.transporte;
  if (modo === 'propio' || modo === 'carro' || modo === 'bus') base.tipoViaje = 'propio';
  else if (modo === 'solicitado' || modo === 'avion' || modo === 'autobus') base.tipoViaje = 'solicitado';

  const persona = comoObjeto(d.persona);
  const viajero = comoObjeto(d.viajero) ?? comoObjeto(d.beneficiario);
  const fuente = persona ?? viajero;
  if (fuente) {
    if (typeof fuente.empleadoId === 'number') base.beneficiarioId = fuente.empleadoId;
    if (typeof fuente.directorioId === 'number' && base.beneficiarioId === null) base.beneficiarioId = fuente.directorioId;
    if (typeof fuente.nombre === 'string' && fuente.nombre.trim() !== '') base.beneficiarioNombre = fuente.nombre.trim();
    if (typeof fuente.nombreCompleto === 'string' && !base.beneficiarioNombre) base.beneficiarioNombre = fuente.nombreCompleto.trim();
    if ((fuente.modo === 'mia' || d.modoNombre === 'mi') && base.beneficiarioId === null) base.beneficiarioId = -1; 
  }
  const personas = Array.isArray(d.personas) ? d.personas : [];
  if (!base.beneficiarioNombre && personas.length > 0) {
    const nombre = comoObjeto(personas[0])?.nombre;
    if (typeof nombre === 'string' && nombre.trim() !== '') base.beneficiarioNombre = nombre.trim();
  }

  const acompanantes = Array.isArray(transporte?.acompanantes) ? (transporte!.acompanantes as unknown[]) : [];
  for (const a of acompanantes) {
    const id = comoObjeto(a)?.directorioId;
    if (typeof id === 'number') base.compartidoConIds.push(id);
  }
  if (typeof d.compartidoPor === 'string') base.compartidoPor = d.compartidoPor;

  return base;
}

export interface Distintivo {
  clave: string;
  texto: string;
}

export function clasificarRelacion(
  solicitud: Pick<Solicitud, 'id_usuario_solicitante'>,
  resumen: ResumenViaje,
  miId: number | undefined,
  miNombre: string | undefined,
): Distintivo[] {
  const distintivos: Distintivo[] = [];
  const esMio = miId !== undefined && solicitud.id_usuario_solicitante === miId;
  const soyBeneficiario =
    (resumen.beneficiarioId !== null && (resumen.beneficiarioId === miId || (esMio && resumen.beneficiarioId === -1))) ||
    (resumen.beneficiarioId === null && resumen.beneficiarioNombre === null && esMio) ||
    (resumen.beneficiarioNombre !== null && miNombre !== undefined && resumen.beneficiarioNombre.toLocaleLowerCase('es-MX') === miNombre.toLocaleLowerCase('es-MX'));

  if (esMio && soyBeneficiario) distintivos.push({ clave: 'propio', texto: 'Solicitada por mí para mí' });
  else if (esMio) distintivos.push({ clave: 'para-otro', texto: 'Creada por mí para otra persona' });
  else if (soyBeneficiario) distintivos.push({ clave: 'para-mi', texto: 'Solicitada para mí por otra persona' });

  if (!esMio && miId !== undefined && resumen.compartidoConIds.includes(miId)) {
    const quien = resumen.compartidoPor ?? 'la persona solicitante';
    distintivos.push({ clave: 'compartida', texto: `Compartida conmigo (por ${quien})` });
  }
  return distintivos;
}

export type FiltroPeriodo = 'dia' | 'semana' | 'quincena' | 'mes' | 'anio' | 'personalizado' | 'todo';

export const ETIQUETA_PERIODO: Record<FiltroPeriodo, string> = {
  todo: 'Todo',
  dia: 'Día',
  semana: 'Semana (últimos 7 días)',
  quincena: 'Quincena (1–15 o 16–fin de mes)',
  mes: 'Mes',
  anio: 'Año',
  personalizado: 'Periodo personalizado',
};

function isoFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function rangoDelFiltro(periodo: FiltroPeriodo, referencia: Date, desde = '', hasta = ''): { inicio: string; fin: string } | null {
  if (periodo === 'todo') return null;
  if (periodo === 'personalizado') {
    return desde !== '' && hasta !== '' ? { inicio: desde, fin: hasta } : null;
  }
  const ref = isoFecha(referencia);
  if (periodo === 'dia') return { inicio: ref, fin: ref };
  if (periodo === 'semana') {
    const fin = new Date(referencia);
    const inicio = new Date(referencia);
    inicio.setDate(inicio.getDate() - 6);
    return { inicio: isoFecha(inicio), fin: isoFecha(fin) };
  }
  if (periodo === 'mes') {
    const y = referencia.getFullYear();
    const m = String(referencia.getMonth() + 1).padStart(2, '0');
    const ultimo = new Date(y, referencia.getMonth() + 1, 0).getDate();
    return { inicio: `${y}-${m}-01`, fin: `${y}-${m}-${String(ultimo).padStart(2, '0')}` };
  }
  if (periodo === 'anio') {
    const y = referencia.getFullYear();
    return { inicio: `${y}-01-01`, fin: `${y}-12-31` };
  }
  const y = referencia.getFullYear();
  const m = String(referencia.getMonth() + 1).padStart(2, '0');
  if (referencia.getDate() <= 15) return { inicio: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  const ultimo = new Date(y, referencia.getMonth() + 1, 0).getDate();
  return { inicio: `${y}-${m}-16`, fin: `${y}-${m}-${String(ultimo).padStart(2, '0')}` };
}

export function enRango(fechaCreacion: string, rango: { inicio: string; fin: string } | null): boolean {
  if (!rango) return true;
  const dia = fechaCreacion.slice(0, 10);
  return dia >= rango.inicio && dia <= rango.fin;
}

export interface FilaViaje {
  solicitud: Solicitud;
  resumen: ResumenViaje;
}

export const TIPOS_VIAJE: { id: TipoViaje | 'todos'; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'propio', etiqueta: 'Carro propio' },
  { id: 'solicitado', etiqueta: 'Transporte solicitado' },
  { id: 'sin-clasificar', etiqueta: 'Sin clasificar' },
];

export function nombreCreadorDe(solicitud: Solicitud, miId?: number, miNombre?: string): string {
  const nombre = solicitud.nombre_creador?.trim();
  if (nombre) return nombre;
  const idCreador = solicitud.id_usuario_creacion ?? solicitud.id_usuario_solicitante;
  if (miId !== undefined && idCreador === miId && miNombre?.trim()) return miNombre;
  return `Usuario #${idCreador}`;
}

export function fechaLarga(fecha: string): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return Number.isNaN(d.getTime())
    ? fecha
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const COLOR_POR_ESTADO: Record<string, string> = {
  borrador: '#64748b',
  enviada: '#2563eb',
  autorizada: '#16a34a',
  autorizada_con_ajustes: '#d97706',
  rechazada: '#dc2626',
};

export function colorEstado(estado: string): string {
  return COLOR_POR_ESTADO[estado] ?? '#64748b';
}

function objetoPlano(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function personasInvolucradas(solicitud: Solicitud): number {
  const datos = objetoPlano(solicitud.datos);
  const transporte = objetoPlano(datos?.transporte);
  const acompanantes = Array.isArray(transporte?.acompanantes) ? transporte!.acompanantes.length : 0;
  return 1 + acompanantes;
}

export function modoTransporte(solicitud: Solicitud): 'propio' | 'solicitado' {
  const datos = objetoPlano(solicitud.datos);
  const transporte = objetoPlano(datos?.transporte);
  return transporte?.modo === 'propio' ? 'propio' : 'solicitado';
}

export function tipoTransporte(solicitud: Solicitud): string {
  return modoTransporte(solicitud) === 'propio' ? 'Carro propio' : 'Solicitud de transporte';
}

export function costoViaje(solicitud: Solicitud): number | null {
  const datos = objetoPlano(solicitud.datos);
  const totalSnapshot = Number(datos?.total);
  if (Number.isFinite(totalSnapshot) && totalSnapshot > 0) return totalSnapshot;

  const gastos = objetoPlano(datos?.gastos);
  const comidas = Number(gastos?.comidas) || 0;
  const extras = (Array.isArray(gastos?.extras) ? gastos!.extras : []).reduce<number>((suma, extra) => {
    const obj = objetoPlano(extra);
    const monto = obj ? Number(obj.monto) : Number(extra);
    return suma + (Number.isFinite(monto) ? monto : 0);
  }, 0);
  const elegidas = solicitud.opciones
    .filter((opcion) => opcion.fue_elegida)
    .reduce((suma, opcion) => suma + (opcion.precio ?? 0), 0);

  const total = comidas + extras + elegidas;
  return total > 0 ? total : null;
}

export function mxn(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function opcionesDePropuesta(opciones: OpcionCotizacion[]): SolicitudOpcion[] {
  return opciones.map((opcion, indice) => ({
    id_opcion: -(indice + 1),
    tipo: opcion.tipo,
    linea: opcion.linea,
    precio: opcion.precio,
    moneda: opcion.moneda ?? null,
    url_compra: opcion.url_compra ?? null,
    fuente: opcion.fuente,
    fue_elegida: opcion.fue_elegida,
    ruta_captura: opcion.ruta_captura ?? null,
    datos: opcion.datos ?? null,
  }));
}
