import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, ChevronDown, Eye, Printer, SlidersHorizontal, Square, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import { solicitudesApi } from '../../services/solicitudes.api';
import {
  estadoTexto,
  importeFormateado,
  type SolicitudBandeja,
} from '../../types/aprobaciones.types';
import type { Solicitud } from '../../types/solicitud.types';
import { filaConcentrado } from '../aprobaciones/ConcentradoViaticosView';
import { esEstadoConcentrable, filaVuelos } from './filaVuelos';
import { VistaDetalle } from '../mis-viajes/MisViajesPage';
import { RechazarSolicitudDialog } from '../autorizaciones/RechazarSolicitudDialog';
import {
  ConcentradoDocumentoPreview,
  type FormatoConcentrado,
} from './ConcentradoDocumentoPreview';
import { ConcentradoViaticosPrint } from '../costos/ConcentradoViaticosPrint';
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

const DEFINICIONES_ACTIVO: { id: string; etiqueta: string; estados: string[] }[] = [
  { id: 'autorizadas', etiqueta: 'Autorizadas (listas para concentrar)', estados: ['autorizada', 'autorizada_con_ajustes'] },
  { id: 'enviada', etiqueta: 'Enviadas (todavía sin autorizar)', estados: ['enviada'] },
  { id: 'todas', etiqueta: 'Todas (enviadas, autorizadas y rechazadas)', estados: [] as string[] },
] as const;
type DefinicionActivo = string;

const TIPOS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'aereo', etiqueta: 'Aéreo' },
  { id: 'autobus', etiqueta: 'Autobús' },
  { id: 'propio', etiqueta: 'Carro propio' },
  { id: 'solicitado', etiqueta: 'Solicitado (sin medio elegido)' },
  { id: 'sin-clasificar', etiqueta: 'Sin clasificar' },
] as const;

const ETIQUETA_TRANSPORTE: Record<string, string> = {
  aereo: 'Aéreo',
  autobus: 'Autobús',
  propio: 'Carro propio',
  solicitado: 'Solicitado',
  'sin-clasificar': 'Sin clasificar',
};

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

const ESTADOS_DEVOLUBLES = ['autorizada', 'autorizada_con_ajustes'];

function sePuedeDevolver(estado: string): boolean {
  return ESTADOS_DEVOLUBLES.includes(estado);
}

function fechaCreadaCorta(fecha: string): string {
  const dia = fecha.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? fechaCorta(dia) : fecha;
}

const ENCABEZADO_PARTIDO = 'whitespace-normal leading-tight';

function tipoDeFila(f: SolicitudBandeja): string {
  if (f.avion !== null && f.avion !== undefined) return 'aereo';
  if (f.autobus !== null && f.autobus !== undefined) return 'autobus';
  if (f.gasolina !== null && f.gasolina !== undefined) return 'propio';
  return 'sin-clasificar';
}

function tipoTransporteDeFila(f: SolicitudBandeja): string {
  return f.tipo_transporte ?? tipoDeFila(f);
}

export function ConcentradoPage() {
  usePageTitle('Concentrado de viáticos', 'Viáticos');

  const [filas, setFilas] = useState<SolicitudBandeja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string>('todos');
  const [definicion, setDefinicion] = useState<DefinicionActivo>('autorizadas');
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>('todas');
  const [campoFecha, setCampoFecha] = useState<CampoFecha>('modificacion');  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [revisandoId, setRevisandoId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [devolviendo, setDevolviendo] = useState<SolicitudBandeja | null>(null);
  const [motivoDevolucion, setMotivoDevolucion] = useState('');
  const [procesandoDevolucion, setProcesandoDevolucion] = useState(false);
  const [documentoAbierto, setDocumentoAbierto] = useState(false);
  const [imprimirAlAbrir, setImprimirAlAbrir] = useState(false);
  const [enviarConcentradoAbierto, setEnviarConcentradoAbierto] = useState(false);
  const [seleccionadasIds, setSeleccionadasIds] = useState<Set<number>>(() => new Set());
  const [formato, setFormato] = useState<FormatoConcentrado>('for-008');

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

  const hoy = new Date();
  const rango = rangoDeFiltroFecha(filtroFecha, hoy, desde, hasta);

  const [recalculo, setRecalculo] = useState<'con' | 'sin' | 'todos'>('con');
  const [agruparPor, setAgruparPor] = useState<GrupoConcentrado>('gerencia');

  const visibles = filas.filter(
    (f) =>
      f.estado !== 'borrador' &&
      (recalculo === 'todos' || (recalculo === 'con' ? f.recalculada === true : f.recalculada !== true)) &&
      (campoFecha === 'viaje'
        ? viajeEnRango(f, rango)
        : campoFecha === 'creacion'
          ? creacionEnRango(f, rango)
          : modificacionEnRango(f, rango)) &&
      (estadosActivos.length === 0 || estadosActivos.includes(f.estado)) &&
      (tipo === 'todos' || tipoTransporteDeFila(f) === tipo),
  );

  const claveGrupo = (fila: SolicitudBandeja): string =>
    agruparPor === 'gerencia' ? gerenciaVisible(fila.gerencia) : fila.nombre_solicitante;

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
  }, []);

  const abrirDevolucion = useCallback((fila: SolicitudBandeja) => {
    setMotivoDevolucion('');
    setDevolviendo(fila);
  }, []);

  const cerrarDevolucion = useCallback(() => {
    if (procesandoDevolucion) return;
    setDevolviendo(null);
    setMotivoDevolucion('');
  }, [procesandoDevolucion]);

  const devolver = useCallback(async () => {
    if (devolviendo === null) return;
    const idSolicitud = devolviendo.id_solicitud;
    const motivo = motivoDevolucion.trim();
    if (motivo === '') {
      toast.error('Escribe el motivo de la devolución.');
      return;
    }
    setProcesandoDevolucion(true);
    try {
      const res = await aprobacionesApi.devolver(idSolicitud, motivo);
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo devolver la solicitud.');
        return;
      }
      toast.success('Solicitud devuelta a autorizaciones. Vuelve a estar pendiente de revisión.');
      setDevolviendo(null);
      setMotivoDevolucion('');
      setSeleccionadasIds((previas) => {
        const siguientes = new Set(previas);
        siguientes.delete(idSolicitud);
        return siguientes;
      });
      await cargar();
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo devolver la solicitud.');
    } finally {
      setProcesandoDevolucion(false);
    }
  }, [cargar, devolviendo, motivoDevolucion]);

  const seleccionables = filasOrdenadas.filter((fila) => esEstadoConcentrable(fila.estado));
  const seleccionadas = filas.filter(
    (fila) => seleccionadasIds.has(fila.id_solicitud) && esEstadoConcentrable(fila.estado),
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

  const abrirDocumento = useCallback((siguiente: FormatoConcentrado, imprimir = false) => {
    setFormato(siguiente);
    setImprimirAlAbrir(imprimir);
    setDocumentoAbierto(true);
  }, []);

  const filasDelDocumento = seleccionadas.length > 0 ? seleccionadas : visibles;
  const gerencias = Array.from(new Set(filasDelDocumento.map((v) => gerenciaVisible(v.gerencia))));
  const gerenciaDocumento = gerencias.length === 1 ? gerencias[0] : gerencias.length > 1 ? 'VARIAS' : undefined;
  const tituloDocumento = `${ETIQUETA_FILTRO_FECHA[filtroFecha]} · ${seleccionadas.length} ${
    seleccionadas.length === 1 ? 'solicitud' : 'solicitudes'
  }${agruparPor === 'ninguna' ? '' : ` · agrupado por ${GRUPO_LABELS[agruparPor].toLowerCase()}`}`;
  const folioDevolucion =
    devolviendo?.folio ?? (devolviendo !== null ? `#${devolviendo.id_solicitud}` : '');

  const columnas = useMemo<ColumnDef<SolicitudBandeja>[]>(
    () => [
      {
        id: 'seleccion',
        enableHiding: false,
        header: () => {
          const etiqueta = todasSeleccionadas
            ? 'Deseleccionar todas las solicitudes'
            : 'Seleccionar todas las solicitudes';
          return (
            <button
              type="button"
              className="flex items-center justify-center"
              aria-label={etiqueta}
              title={etiqueta}
              disabled={seleccionables.length === 0}
              onClick={alternarTodas}
            >
              {todasSeleccionadas ? (
                <CheckSquare className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </button>
          );
        },
        enableSorting: false,
        cell: ({ row }) => {
          const habilitada = esEstadoConcentrable(row.original.estado);
          const folio = row.original.folio ?? `#${row.original.id_solicitud}`;
          return (
            <div onClick={(evento) => evento.stopPropagation()}>
              <Checkbox
                checked={seleccionadasIds.has(row.original.id_solicitud) && habilitada}
                disabled={!habilitada}
                aria-label={
                  habilitada
                    ? `Incluir ${folio} en el concentrado`
                    : `La solicitud ${folio} no se puede concentrar: está rechazada o sigue en borrador`
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
          <div className="flex flex-col whitespace-nowrap">
            <span className="font-medium">{row.original.folio ?? `#${row.original.id_solicitud}`}</span>
            <span className="text-xs text-muted-foreground">{fechaCreadaCorta(row.original.fecha_creacion)}</span>
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
        header: () => <span className={ENCABEZADO_PARTIDO}>Fecha del viaje</span>,
        accessorFn: (fila) => fila.fecha ?? '',
        cell: ({ row }) => <span className="text-xs">{row.original.fecha ?? '—'}</span>,
      },
      {
        id: 'transporte',
        header: 'Transporte',
        accessorFn: (fila) => ETIQUETA_TRANSPORTE[tipoTransporteDeFila(fila)] ?? 'Sin clasificar',
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        id: 'costo',
        header: () => <span className={ENCABEZADO_PARTIDO}>Costo del viaje</span>,
        accessorFn: (fila) => fila.total ?? 0,
        cell: ({ row }) => {
          const total = row.original.total;
          return (
            <span className="whitespace-nowrap text-sm font-medium tabular-nums">
              {total !== null ? importeFormateado(total, 'MXN') : '—'}
            </span>
          );
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
        cell: ({ row }) => {
          const folio = row.original.folio ?? `#${row.original.id_solicitud}`;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label={`Ver detalle ${folio}`}
                title={`Ver detalle ${folio}`}
                onClick={(evento) => {
                  evento.stopPropagation();
                  void revisar(row.original.id_solicitud);
                }}
              >
                <Eye className="h-4 w-4" aria-hidden />
              </Button>
              {sePuedeDevolver(row.original.estado) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label={`Rechazar y devolver a autorizaciones ${folio}`}
                  title="Rechazar y devolver a autorizaciones"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirDevolucion(row.original);
                  }}
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      revisar,
      abrirDevolucion,
      seleccionadasIds,
      todasSeleccionadas,
      seleccionables,
      alternarSeleccion,
      alternarTodas,
    ],
  );

  const filtrosAplicados = [
    filtroFecha !== 'todas',
    campoFecha !== 'modificacion',
    tipo !== 'todos',
    recalculo !== 'con',
    agruparPor !== 'gerencia',
    definicion !== 'todas',
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card">
        <details className="group">
          <summary className="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Filtros
            {filtrosAplicados > 0 ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {filtrosAplicados} {filtrosAplicados === 1 ? 'aplicado' : 'aplicados'}
              </span>
            ) : null}
            <ChevronDown
              className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="grid gap-3 border-t px-4 py-3 md:grid-cols-4">
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
        </details>
        <div className="space-y-1 px-4 pb-3">
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
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <DataTable
            columns={columnas}
            data={filasOrdenadas}
            title="Solicitudes para el concentrado"
            subtitle={
              `${seleccionables.length} seleccionable${seleccionables.length === 1 ? '' : 's'} · ` +
              `${visibles.length} visibles`
            }
            className="[&_td]:px-1.5 [&_th]:px-1.5"
            pagination
            pageSize={10}
            height={520}
            loading={cargando}
            showRefreshButton
            onRefresh={() => { void cargar(); }}
            filterConfig={{
              tableId: 'viaticos-concentrado-v3',
              searchableColumns: ['destino', 'solicitante', 'estado', 'gerencia'],
              defaultSearchColumns: ['destino'],
              requiredColumns: ['seleccion'],
              defaultVisibleColumns: [
                'seleccion',
                'solicitud',
                'destino',
                'fechas',
                'transporte',
                'costo',
                'solicitante',
                'gerencia',
                'estado',
                'acciones',
              ],
            }}
            rowTestId={(fila) => `concentrado-${fila.id_solicitud}`}
            isRowSelected={(fila) => seleccionadasIds.has(fila.id_solicitud)}
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
              {seleccionadas.length === 0
                ? ' · marca solicitudes para incluirlas en el documento'
                : ''}
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
            <span className="text-sm font-medium text-muted-foreground">Vista previa del concentrado</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => abrirDocumento('for-008', true)}
                disabled={seleccionadas.length === 0}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Vista previa
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setEnviarConcentradoAbierto(true)}
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
                <span className="text-sm">Selecciona solicitudes para ver el concentrado</span>
                <span className="max-w-sm text-xs opacity-70">
                  Se imprime exactamente lo que marcas, con el importe que tiene cada solicitud.
                </span>
              </div>
            ) : (
              <div className="min-w-[820px] bg-white shadow-sm">
                <ConcentradoViaticosPrint
                  solicitudes={seleccionadas.map(filaConcentrado)}
                  gerencia={gerenciaDocumento}
                  grupoPor={agruparPor}
                  soloAutorizadas={false}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <ConcentradoDocumentoPreview
        abierto={documentoAbierto}
        solicitudes={seleccionadas.map(filaConcentrado)}
        vuelos={seleccionadas.map(filaVuelos)}
        formato={formato}
        titulo={tituloDocumento}
        gerencia={gerenciaDocumento}
        grupoPor={agruparPor}
        soloAutorizadas={false}
        imprimirAlAbrir={imprimirAlAbrir}
        onCerrar={() => {
          setDocumentoAbierto(false);
          setImprimirAlAbrir(false);
        }}
      />

      <Dialog open={enviarConcentradoAbierto} onOpenChange={setEnviarConcentradoAbierto}>
        <DialogContent
          data-testid="enviar-concentrado"
          className="h-[92vh] w-[94vw] max-w-[1400px] overflow-hidden p-4 sm:p-6"
        >
          <DialogHeader>
            <DialogTitle>Enviar a concentrado</DialogTitle>
            <DialogDescription>
              Revisa el concentrado antes de enviarlo. Incluye{' '}
              {seleccionadas.length} {seleccionadas.length === 1 ? 'solicitud' : 'solicitudes'}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-zinc-100 p-3 dark:bg-zinc-900">
            <div className="min-w-[820px] bg-white shadow-sm">
              <ConcentradoViaticosPrint
                solicitudes={seleccionadas.map(filaConcentrado)}
                gerencia={gerenciaDocumento}
                grupoPor={agruparPor}
                soloAutorizadas={false}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEnviarConcentradoAbierto(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => window.alert('Función aún en desarrollo')}>
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revisandoId !== null}
        onOpenChange={(abierto) => {
          if (!abierto) cerrarRevision();
        }}
      >
        <DialogContent data-testid="revision-solicitud" className="max-h-[92vh] w-[94vw] max-w-[1500px] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Detalle de la solicitud {detalle?.folio ?? (revisandoId !== null ? `#${revisandoId}` : '')}</DialogTitle>
            <DialogDescription>
              Consulta de la solicitud ya concentrada. La autorización se hace antes, en
              la pantalla de Autorizaciones.
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle ? <p role="status">Cargando revisión…</p> : null}
          {detalle ? (
            <VistaDetalle solicitud={detalle} modoRevision pestanaInicial="autorizada" />
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cerrarRevision}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RechazarSolicitudDialog
        abierto={devolviendo !== null}
        folio={folioDevolucion}
        motivo={motivoDevolucion}
        procesando={procesandoDevolucion}
        titulo={`¿Rechazar la solicitud ${folioDevolucion}?`}
        descripcion="Saldrá del concentrado y volverá a Autorizaciones como pendiente de revisión. El motivo queda registrado en la solicitud."
        etiquetaMotivo="Motivo por el que vuelve a autorizaciones"
        etiquetaConfirmar="Devolver a autorizaciones"
        etiquetaProcesando="Devolviendo…"
        onMotivo={setMotivoDevolucion}
        onCancelar={cerrarDevolucion}
        onConfirmar={() => {
          void devolver();
        }}
      />
    </div>
  );
}

export default ConcentradoPage;
