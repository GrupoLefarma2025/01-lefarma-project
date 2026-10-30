import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, Eye, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import { solicitudesApi } from '../../services/solicitudes.api';
import {
  ESTADO_ENVIADA,
  estadoTexto,
  importeFormateado,
  type SolicitudBandeja,
} from '../../types/aprobaciones.types';
import type { Solicitud } from '../../types/solicitud.types';
import type { PropuestaRuta } from '../../types/solicitud.types';
import { esEstadoConcentrado, filaConcentrado } from '../aprobaciones/ConcentradoViaticosView';
import { VistaDetalle } from '../mis-viajes/MisViajesPage';
import { ConcentradoDocumentoPreview } from './ConcentradoDocumentoPreview';
import { ConcentradoViaticosPrint } from '../costos/ConcentradoViaticosPrint';
import { CalculosViajeModal } from '../../components/CalculosViajeModal';
import { GRUPO_LABELS, type GrupoConcentrado } from '../../constants/grupos';
import { gerenciaVisible } from '../../constants/gerencias';
import {
  ETIQUETA_CAMPO_FECHA,
  ETIQUETA_FILTRO_FECHA,
  creacionEnRango,
  fechaCorta,
  modificacionEnRango,
  rangoDeFiltroFecha,
  viajeEnRango,
  type CampoFecha,
  type FiltroFecha,
} from './periodo.helpers';

/**
 * Vista de revisión (prototipo UI). «Activo» es un contrato sin resolver: la
 * definición se elige en la interfaz y se muestra, no se fija como política de
 * archivo. La revisión autoriza la OPCIÓN ELEGIDA por la persona viajera; las
 * alternativas se muestran como evidencia histórica con sus precios originales.
 */
const DEFINICIONES_ACTIVO: { id: string; etiqueta: string; estados: string[] }[] = [
  { id: 'enviada', etiqueta: 'Enviadas (pendientes de autorización)', estados: ['enviada'] },
  { id: 'todas', etiqueta: 'Todas (enviadas, autorizadas y rechazadas)', estados: [] as string[] },
] as const;
type DefinicionActivo = string;

const TIPOS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'aereo', etiqueta: 'Aéreo' },
  { id: 'autobus', etiqueta: 'Autobús' },
  { id: 'propio', etiqueta: 'Carro propio' },
  { id: 'sin-clasificar', etiqueta: 'Sin clasificar' },
] as const;

const ETIQUETA_TRANSPORTE: Record<string, string> = {
  aereo: 'Aéreo',
  autobus: 'Autobús',
  propio: 'Carro propio',
  'sin-clasificar': 'Sin clasificar',
};

/** Mismo lenguaje de color por estado que /viaticos/mis-viajes. */
const COLOR_POR_ESTADO: Record<string, string> = {
  borrador: '#64748b',
  enviada: '#2563eb',
  autorizada: '#16a34a',
  autorizada_con_ajustes: '#d97706',
  rechazada: '#dc2626',
};

function colorEstado(estado: string): string {
  return COLOR_POR_ESTADO[estado] ?? '#64748b';
}

/** Fecha larga al estilo de mis-viajes: "23 de octubre de 2026". */
function fechaLarga(fecha: string): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return Number.isNaN(d.getTime())
    ? fecha
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

function tipoDeFila(f: SolicitudBandeja): string {
  if (f.avion !== null && f.avion !== undefined) return 'aereo';
  if (f.autobus !== null && f.autobus !== undefined) return 'autobus';
  if (f.gasolina !== null && f.gasolina !== undefined) return 'propio';
  return 'sin-clasificar';
}

export function ConcentradoPage() {
  usePageTitle('Concentrado de viáticos', 'Viáticos');
  const puedeAutorizar = usePermission({ require: 'viaticos.autorizar' });

  const [filas, setFilas] = useState<SolicitudBandeja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string>('todos');
  const [definicion, setDefinicion] = useState<DefinicionActivo>('todas');
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>('todas');
  const [campoFecha, setCampoFecha] = useState<CampoFecha>('modificacion');  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [revisandoId, setRevisandoId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [comentario, setComentario] = useState('');
  const [accionando, setAccionando] = useState(false);
  const [documentoAbierto, setDocumentoAbierto] = useState(false);
  const [seleccionadasIds, setSeleccionadasIds] = useState<Set<number>>(() => new Set());
  const [calculoAbierto, setCalculoAbierto] = useState(false);
  /** Última propuesta calculada en esta revisión; no se persiste hasta autorizar. */
  const [propuesta, setPropuesta] = useState<(PropuestaRuta & { id_solicitud: number }) | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await aprobacionesApi.bandeja({});
      if (res.data.success) setFilas(res.data.data ?? []);
      else setError(res.data.message ?? 'No se pudo cargar el concentrado.');
    } catch (falla: unknown) {
      setError(toApiError(falla).message || 'No se pudo cargar el concentrado.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const estadosActivos = DEFINICIONES_ACTIVO.find((d) => d.id === definicion)!.estados;

  // «Hoy» se resuelve al renderizar: una pestaña abierta toda la noche sigue
  // mostrando el día real.
  const hoy = new Date();
  const rango = rangoDeFiltroFecha(filtroFecha, hoy, desde, hasta);

  const [recalculo, setRecalculo] = useState<'con' | 'sin' | 'todos'>('con');
  /** Criterio de agrupación del concentrado y del documento FOR-008. */
  const [agruparPor, setAgruparPor] = useState<GrupoConcentrado>('gerencia');

  const visibles = filas.filter(
    (f) =>
      // Un borrador no se ha enviado: no tiene nada que autorizar y no debe
      // aparecer en el concentrado, aunque ya tenga cálculo.
      f.estado !== 'borrador' &&
      (recalculo === 'todos' || (recalculo === 'con' ? f.recalculada === true : f.recalculada !== true)) &&
      (campoFecha === 'viaje'
        ? viajeEnRango(f, rango)
        : campoFecha === 'creacion'
          ? creacionEnRango(f, rango)
          : modificacionEnRango(f, rango)) &&
      (estadosActivos.length === 0 || estadosActivos.includes(f.estado)) &&
      (tipo === 'todos' || tipoDeFila(f) === tipo),
  );

  /** Llave con la que se agrupa una fila; la gerencia vacía cae a «Sin asignar». */
  const claveGrupo = (fila: SolicitudBandeja): string =>
    agruparPor === 'gerencia' ? gerenciaVisible(fila.gerencia) : fila.nombre_solicitante;

  // Agrupado = mismas filas visibles, ordenadas por el criterio elegido para
  // que los bloques del documento y la tabla cuenten la misma historia.
  const filasOrdenadas =
    agruparPor === 'ninguna'
      ? visibles
      : [...visibles].sort(
          (a, b) =>
            claveGrupo(a).localeCompare(claveGrupo(b), 'es-MX') ||
            a.nombre_solicitante.localeCompare(b.nombre_solicitante, 'es-MX'),
        );

  const gruposConcentrado = (() => {
    if (agruparPor === 'ninguna') return [];
    const mapa = new Map<string, { total: number; importe: number }>();
    for (const fila of filasOrdenadas) {
      const clave = claveGrupo(fila);
      const actual = mapa.get(clave) ?? { total: 0, importe: 0 };
      actual.total += 1;
      actual.importe += fila.total ?? 0;
      mapa.set(clave, actual);
    }
    return [...mapa.entries()].map(([grupo, datos]) => ({ grupo, ...datos }));
  })();

  const revisar = useCallback(async (id: number) => {
    setRevisandoId(id);
    setDetalle(null);
    setComentario('');
    setPropuesta(null);
    setCargandoDetalle(true);
    try {
      const res = await solicitudesApi.detalle(id);
      if (res.data.success && res.data.data) setDetalle(res.data.data);
      else toast.error(res.data.message ?? 'No se pudo cargar la revisión.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo cargar la revisión.');
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  const cerrarRevision = useCallback(() => {
    setRevisandoId(null);
    setDetalle(null);
    setCalculoAbierto(false);
    setPropuesta(null);
  }, []);

  async function aprobar() {
    if (revisandoId === null || accionando) return;
    setAccionando(true);
    try {
      // La autorización usa la última propuesta calculada. Si el revisor no
      // recalculó nada, se autoriza la ruta que eligió la persona viajera.
      const res = propuesta?.id_solicitud === revisandoId
        ? await aprobacionesApi.autorizar(revisandoId, {
            calculo: propuesta.calculo,
            opciones: propuesta.opciones,
          })
        : await aprobacionesApi.autorizar(revisandoId);
      if (res.data.success) {
        toast.success(
          res.data.message
            ?? (propuesta?.id_solicitud === revisandoId
              ? `Ruta recalculada de la solicitud ${revisandoId} autorizada.`
              : `Solicitud ${revisandoId} autorizada.`),
        );
        setFilas((fs) => fs.map((f) => (f.id_solicitud === revisandoId ? { ...f, estado: 'autorizada' } : f)));
        cerrarRevision();
        await cargar();
      } else toast.error(res.data.message ?? 'No se pudo autorizar.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo autorizar.');
    } finally {
      setAccionando(false);
    }
  }

  async function rechazar() {    if (revisandoId === null || accionando || comentario.trim() === '') return;
    setAccionando(true);
    try {
      const res = await aprobacionesApi.rechazar(revisandoId, comentario.trim());
      if (res.data.success) {
        toast.success(res.data.message ?? `Solicitud ${revisandoId} rechazada.`);
        setFilas((fs) => fs.map((f) => (f.id_solicitud === revisandoId ? { ...f, estado: 'rechazada' } : f)));
        cerrarRevision();
      } else toast.error(res.data.message ?? 'No se pudo rechazar.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo rechazar.');
    } finally {
      setAccionando(false);
    }
  }

  const filaRevisada = revisandoId !== null ? filas.find((f) => f.id_solicitud === revisandoId) ?? null : null;
  const esAutorizable = filaRevisada?.estado === ESTADO_ENVIADA && puedeAutorizar;
  const propuestaRevisada =
    propuesta !== null && propuesta.id_solicitud === revisandoId ? propuesta : null;

  const alRecibirPropuesta = useCallback(
    (nueva: PropuestaRuta) => {
      if (revisandoId === null) return;
      setPropuesta({ ...nueva, id_solicitud: revisandoId });
      setCalculoAbierto(false);
    },
    [revisandoId],
  );

  // La selección de la tabla significa «incluir en el concentrado». Solo las
  // autorizadas son elegibles: una enviada todavía no tiene ruta definitiva.
  const seleccionables = filasOrdenadas.filter((fila) => esEstadoConcentrado(fila.estado));
  const seleccionadas = filas.filter(
    (fila) => seleccionadasIds.has(fila.id_solicitud) && esEstadoConcentrado(fila.estado),
  );
  const importesSeleccionados = seleccionadas
    .map((fila) => fila.total)
    .filter((total): total is number => total !== null && total !== undefined);
  const totalSeleccionado = importesSeleccionados.length > 0
    ? importesSeleccionados.reduce((suma, total) => suma + total, 0)
    : null;
  const todasSeleccionadas =
    seleccionables.length > 0 && seleccionables.every((fila) => seleccionadasIds.has(fila.id_solicitud));

  const alternarSeleccion = useCallback((id: number) => {
    setSeleccionadasIds((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }, []);

  const alternarTodas = useCallback(() => {
    setSeleccionadasIds((previas) => {
      const siguientes = new Set(previas);
      if (todasSeleccionadas) {
        for (const fila of seleccionables) siguientes.delete(fila.id_solicitud);
      } else {
        for (const fila of seleccionables) siguientes.add(fila.id_solicitud);
      }
      return siguientes;
    });
  }, [seleccionables, todasSeleccionadas]);

  // Encabezado del documento: el filtro activo y cuántas filas lo componen.
  // La gerencia se toma de las filas seleccionadas (o, sin selección, de las
  // visibles) solo cuando todas coinciden; si hay varias se declara "VARIAS".
  const filasDelDocumento = seleccionadas.length > 0 ? seleccionadas : visibles;
  const gerencias = Array.from(new Set(filasDelDocumento.map((v) => gerenciaVisible(v.gerencia))));
  const gerenciaDocumento = gerencias.length === 1 ? gerencias[0] : gerencias.length > 1 ? 'VARIAS' : undefined;
  const tituloDocumento = `${ETIQUETA_FILTRO_FECHA[filtroFecha]} · ${seleccionadas.length} ${
    seleccionadas.length === 1 ? 'solicitud' : 'solicitudes'
  }${agruparPor === 'ninguna' ? '' : ` · agrupado por ${GRUPO_LABELS[agruparPor].toLowerCase()}`}`;

  const columnas = useMemo<ColumnDef<SolicitudBandeja>[]>(
    () => [
      {
        id: 'seleccion',
        header: () => (
          <button
            type="button"
            className="flex items-center justify-center"
            aria-label={todasSeleccionadas ? 'Deseleccionar todas las autorizadas' : 'Seleccionar todas las autorizadas'}
            title={todasSeleccionadas ? 'Deseleccionar todas las autorizadas' : 'Seleccionar todas las autorizadas'}
            disabled={seleccionables.length === 0}
            onClick={alternarTodas}
          >
            {todasSeleccionadas ? (
              <CheckSquare className="h-4 w-4 text-primary" aria-hidden />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
          </button>
        ),
        enableSorting: false,
        cell: ({ row }) => {
          const habilitada = esEstadoConcentrado(row.original.estado);
          return (
            <div onClick={(evento) => evento.stopPropagation()}>
              <Checkbox
                checked={seleccionadasIds.has(row.original.id_solicitud) && habilitada}
                disabled={!habilitada}
                aria-label={
                  habilitada
                    ? `Incluir ${row.original.folio ?? `#${row.original.id_solicitud}`} en el concentrado`
                    : `La solicitud ${row.original.folio ?? `#${row.original.id_solicitud}`} aún no está autorizada`
                }
                onCheckedChange={() => alternarSeleccion(row.original.id_solicitud)}
              />
            </div>
          );
        },
      },
      {
        id: 'solicitud',
        header: 'Folio',
        accessorFn: (fila) => fila.folio ?? fila.id_solicitud,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.folio ?? `#${row.original.id_solicitud}`}</span>
            <span className="text-xs text-muted-foreground">{fechaLarga(row.original.fecha_creacion)}</span>
          </div>
        ),
      },
      {
        id: 'periodo',
        header: 'Periodo',
        accessorFn: (fila) => fila.periodo,
        cell: ({ row }) => <span className="text-xs">{row.original.periodo}</span>,
      },
      {
        id: 'destino',
        header: 'Destino',
        accessorFn: (fila) => fila.destino ?? '',
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.original.destino ?? 'Destino por confirmar'}</span>
            {row.original.origen ? (
              <span className="text-xs text-muted-foreground">Desde {row.original.origen}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'fechas',
        header: 'Fecha del viaje',
        accessorFn: (fila) => fila.fecha ?? '',
        cell: ({ row }) => <span className="text-xs">{row.original.fecha ?? '—'}</span>,
      },
      {
        id: 'transporte',
        header: 'Transporte',
        accessorFn: (fila) => ETIQUETA_TRANSPORTE[tipoDeFila(fila)] ?? 'Sin clasificar',
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        id: 'costo',
        header: 'Costo del viaje',
        accessorFn: (fila) => fila.total ?? 0,
        cell: ({ row }) => {
          const total = row.original.total;
          return <span className="text-sm font-medium">{total !== null ? importeFormateado(total, 'MXN') : '—'}</span>;
        },
      },
      {
        id: 'solicitante',
        header: 'Solicitante',
        accessorFn: (fila) => fila.nombre_solicitante,
        cell: ({ getValue }) => <Badge variant="secondary" className="font-normal">{getValue<string>()}</Badge>,
      },
      {
        id: 'gerencia',
        header: 'Gerencia',
        accessorFn: (fila) => gerenciaVisible(fila.gerencia),
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        id: 'estado',
        header: 'Estado',
        accessorFn: (fila) => estadoTexto(fila.estado),
        cell: ({ row }) => {
          const estado = row.original.estado;
          const color = colorEstado(estado);
          return (
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              style={{ borderColor: color, color, backgroundColor: `${color}15` }}
            >
              {estadoTexto(estado)}
            </span>
          );
        },
      },
      {
        id: 'acciones',
        header: () => <div className="text-right">Acción</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label={`Ver detalle ${row.original.folio ?? `#${row.original.id_solicitud}`}`}
              onClick={(evento) => {
                evento.stopPropagation();
                void revisar(row.original.id_solicitud);
              }}
            >
              <Eye className="h-4 w-4" aria-hidden />
              Ver detalle
            </Button>
          </div>
        ),
      },
    ],
    [
      revisar,
      seleccionadasIds,
      todasSeleccionadas,
      seleccionables,
      alternarSeleccion,
      alternarTodas,
    ],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Concentrado de viáticos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Revisa y autoriza la última ruta calculada de cada viaje. Después selecciona las
          autorizadas para generar el FOR-008.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="concentrado-periodo">Periodo</Label>
              <select
                id="concentrado-periodo"
                aria-label="Periodo"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value as FiltroFecha)}
              >
                {(Object.keys(ETIQUETA_FILTRO_FECHA) as FiltroFecha[]).map((f) => (
                  <option key={f} value={f}>{ETIQUETA_FILTRO_FECHA[f]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="concentrado-campo-fecha">Buscar por</Label>
              <select
                id="concentrado-campo-fecha"
                aria-label="Buscar por"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={campoFecha}
                onChange={(e) => setCampoFecha(e.target.value as CampoFecha)}
              >
                {(Object.keys(ETIQUETA_CAMPO_FECHA) as CampoFecha[]).map((c) => (
                  <option key={c} value={c}>{ETIQUETA_CAMPO_FECHA[c]}</option>
                ))}
              </select>
            </div>
            {filtroFecha === 'personalizado' ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="concentrado-desde">Desde</Label>
                  <Input id="concentrado-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="concentrado-hasta">Hasta</Label>
                  <Input id="concentrado-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
              </>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="concentrado-tipo">Tipo de viaje</Label>
              <select
                id="concentrado-tipo"
                aria-label="Tipo de viaje"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>{t.etiqueta}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="concentrado-recalculo">Recálculo</Label>
              <select
                id="concentrado-recalculo"
                aria-label="Recálculo"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={recalculo}
                onChange={(e) => setRecalculo(e.target.value as 'con' | 'sin' | 'todos')}
              >
                <option value="con">Con cálculo (casetas, vuelos y hoteles)</option>
                <option value="sin">Sin cálculo</option>
                <option value="todos">Todas</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="concentrado-agrupar">Agrupar por</Label>
              <select
                id="concentrado-agrupar"
                aria-label="Agrupar por"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={agruparPor}
                onChange={(e) => setAgruparPor(e.target.value as GrupoConcentrado)}
              >
                {(Object.keys(GRUPO_LABELS) as GrupoConcentrado[]).map((grupo) => (
                  <option key={grupo} value={grupo}>{GRUPO_LABELS[grupo]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="concentrado-activo">Definición de «activo»</Label>
              <select
                id="concentrado-activo"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={definicion}
                onChange={(e) => setDefinicion(e.target.value as DefinicionActivo)}
              >
                {DEFINICIONES_ACTIVO.map((d) => (
                  <option key={d.id} value={d.id}>{d.etiqueta}</option>
                ))}
              </select>
            </div>
          </div>
          {rango ? (
            <p data-testid="rango-visible" className="text-xs text-muted-foreground">
              Mostrando por {ETIQUETA_CAMPO_FECHA[campoFecha].toLowerCase()}: {fechaCorta(rango.inicio)} al{' '}
              {fechaCorta(rango.fin)}.
            </p>
          ) : null}
          {visibles.length < filas.length ? (
            <p data-testid="aviso-recorte" className="text-xs text-muted-foreground">
              {visibles.length} de {filas.length} solicitudes visibles
              {recalculo !== 'todos'
                ? ' · el concentrado revisa las que ya se recalcularon (con casetas, vuelos y hoteles).'
                : definicion !== 'todas'
                  ? ' · las autorizadas y rechazadas se ven eligiendo «Todas» en Definición de «activo».'
                  : ' · el resto queda fuera por el tipo de viaje.'}
            </p>
          ) : null}
          {filtroFecha === 'personalizado' && !rango ? (
            <p className="text-xs text-muted-foreground">Elige la fecha inicial y la final para aplicar el rango.</p>
          ) : null}
          {agruparPor !== 'ninguna' && gruposConcentrado.length > 0 ? (
            <p data-testid="grupos-concentrado" className="text-xs text-muted-foreground">
              {gruposConcentrado.map((grupo, indice) => (
                <span key={grupo.grupo}>
                  {indice > 0 ? ' · ' : null}
                  <strong className="font-medium text-foreground">{grupo.grupo}</strong>{' '}
                  {grupo.total} {grupo.total === 1 ? 'solicitud' : 'solicitudes'}
                  {grupo.importe > 0 ? ` · ${importeFormateado(grupo.importe, 'MXN')}` : ''}
                </span>
              ))}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <DataTable
            columns={columnas}
            data={filasOrdenadas}
            title="Solicitudes para el concentrado"
            subtitle={
              `${seleccionables.length} autorizada${seleccionables.length === 1 ? '' : 's'} · ` +
              `${visibles.length} visibles`
            }
            pagination
            pageSize={10}
            height={520}
            loading={cargando}
            showRefreshButton
            onRefresh={() => { void cargar(); }}
            filterConfig={{
              // v2: agrega la columna Gerencia; el id nuevo evita que una
              // configuración guardada (sin esa columna) la oculte.
              tableId: 'viaticos-concentrado-v2',
              searchableColumns: ['destino', 'solicitante', 'estado', 'gerencia'],
              defaultSearchColumns: ['destino'],
              defaultVisibleColumns: [
                'seleccion',
                'solicitud',
                'destino',
                'fechas',
                'costo',
                'solicitante',
                'gerencia',
                'estado',
                'acciones',
              ],
            }}
            rowTestId={(fila) => `concentrado-${fila.id_solicitud}`}
            onRowClick={(fila) => { void revisar(fila.id_solicitud); }}
          />

          <div
            data-testid="seleccion-concentrado"
            className={
              seleccionadas.length > 0
                ? 'flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5'
                : 'flex items-center justify-between rounded-lg border px-4 py-2.5 text-muted-foreground'
            }
          >
            <div className="text-sm">
              <span className={seleccionadas.length > 0 ? 'font-semibold text-primary' : 'font-semibold'}>
                {seleccionadas.length}
              </span>{' '}
              {seleccionadas.length === 1 ? 'solicitud seleccionada' : 'solicitudes seleccionadas'}
              {seleccionadas.length === 0 ? ' · marca solicitudes autorizadas' : ''}
            </div>
            <div className="flex items-center gap-3">
              {seleccionadas.length > 0 && totalSeleccionado !== null ? (
                <span className="text-sm font-bold tabular-nums">
                  {importeFormateado(totalSeleccionado, 'MXN')}
                </span>
              ) : null}
              {seleccionadas.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSeleccionadasIds(new Set())}
                >
                  Limpiar
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <section className="flex min-w-0 flex-col gap-3" aria-label="Vista previa del concentrado">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground">
              Vista previa del FOR-008
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setDocumentoAbierto(true)}
                disabled={seleccionadas.length === 0}
              >
                Vista previa
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setDocumentoAbierto(true)}
                disabled={seleccionadas.length === 0}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Generar concentrado ({seleccionadas.length})
              </Button>
            </div>
          </div>

          <div className="min-h-[420px] flex-1 overflow-auto rounded-lg border bg-zinc-100 p-3 dark:bg-zinc-900">
            {seleccionadas.length === 0 ? (
              <div
                data-testid="concentrado-vacio"
                className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 text-center text-muted-foreground"
              >
                <div className="text-4xl opacity-30">📄</div>
                <span className="text-sm">
                  Selecciona solicitudes autorizadas para ver el concentrado
                </span>
                <span className="max-w-sm text-xs opacity-70">
                  La ruta autorizada que se imprime es la última que revisó y confirmó el concentrado.
                </span>
              </div>
            ) : (
              <div className="min-w-[820px] bg-white shadow-sm">
                <ConcentradoViaticosPrint
                  solicitudes={seleccionadas.map(filaConcentrado)}
                  gerencia={gerenciaDocumento}
                  grupoPor={agruparPor}
                  soloAutorizadas
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <ConcentradoDocumentoPreview
        abierto={documentoAbierto}
        solicitudes={seleccionadas.map(filaConcentrado)}
        titulo={tituloDocumento}
        gerencia={gerenciaDocumento}
        grupoPor={agruparPor}
        soloAutorizadas
        onCerrar={() => setDocumentoAbierto(false)}
      />

      <Dialog
        open={revisandoId !== null}
        onOpenChange={(abierto) => {
          if (!abierto) cerrarRevision();
        }}
      >
        <DialogContent data-testid="revision-solicitud" className="max-h-[92vh] w-[90vw] max-w-[1400px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisión de la solicitud {detalle?.folio ?? (revisandoId !== null ? `#${revisandoId}` : '')}</DialogTitle>
            <DialogDescription>
              Revisa la última ruta propuesta. Puedes recalcularla cuantas veces necesites; solo
              se guarda cuando autorizas.
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle ? <p role="status">Cargando revisión…</p> : null}
          {detalle ? (
            <div className="space-y-3">
              <VistaDetalle
                solicitud={detalle}
                modoRevision
                pestanaInicial="autorizada"
                propuesta={propuestaRevisada}
                onRecalcular={
                  filaRevisada?.estado === ESTADO_ENVIADA && puedeAutorizar
                    ? () => setCalculoAbierto(true)
                    : undefined
                }
                acciones={
                  filaRevisada?.estado === ESTADO_ENVIADA && puedeAutorizar ? (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={accionando}
                      onClick={() => { void aprobar(); }}
                    >
                      <Check className="h-4 w-4" aria-hidden />
                      {propuestaRevisada ? 'Autorizar ruta recalculada' : 'Autorizar esta ruta'}
                    </Button>
                  ) : undefined
                }
              />
              {propuestaRevisada ? (
                <p className="text-xs text-muted-foreground">
                  Se autorizará la última propuesta visible en «Ruta autorizada». Los recálculos
                  no confirmados no se guardan.
                </p>
              ) : null}
              <div className="space-y-1">
                <Label htmlFor="comentario-revision">Comentario de revisión</Label>
                <Input
                  id="comentario-revision"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Motivo u observaciones"
                />
              </div>
              {!puedeAutorizar ? (
                <p className="text-xs text-muted-foreground">Sin el permiso de autorización los botones no actúan.</p>
              ) : null}
              <p className="text-xs text-muted-foreground">Devolver para corrección: prototipo sin endpoint compatible en esta fase.</p>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Sin endpoint compatible en esta fase"
            >
              Devolver para corrección
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!esAutorizable || accionando || comentario.trim() === ''}
              onClick={rechazar}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {calculoAbierto && detalle ? (
        <CalculosViajeModal
          solicitud={detalle}
          open={calculoAbierto}
          onOpenChange={setCalculoAbierto}
          onEnviado={() => undefined}
          modo="autorizar"
          onPropuesta={alRecibirPropuesta}
        />
      ) : null}
    </div>
  );
}

export default ConcentradoPage;
