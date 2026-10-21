import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  precioTexto,
  type SolicitudBandeja,
} from '../../types/aprobaciones.types';
import type { Solicitud } from '../../types/solicitud.types';
import { filaConcentrado } from '../aprobaciones/ConcentradoViaticosView';
import { ConcentradoDocumentoPreview } from './ConcentradoDocumentoPreview';
import {
  ETIQUETA_CAMPO_FECHA,
  ETIQUETA_FILTRO_FECHA,
  creacionEnRango,
  fechaCorta,
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
  { id: 'enviada-borrador', etiqueta: 'Enviadas + borradores', estados: ['enviada', 'borrador'] },
  { id: 'todas', etiqueta: 'Todas (incluye autorizadas y rechazadas)', estados: [] as string[] },
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
  const veTodos = usePermission({ require: 'viaticos.ver_todos' });
  const puedeAutorizar = usePermission({ require: 'viaticos.autorizar' });

  const [filas, setFilas] = useState<SolicitudBandeja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string>('todos');
  const [definicion, setDefinicion] = useState<DefinicionActivo>('enviada');
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>('hoy');
  const [campoFecha, setCampoFecha] = useState<CampoFecha>('creacion');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [revisandoId, setRevisandoId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [comentario, setComentario] = useState('');
  const [accionando, setAccionando] = useState(false);
  const [documentoAbierto, setDocumentoAbierto] = useState(false);

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

  const visibles = filas.filter(
    (f) =>
      (campoFecha === 'viaje' ? viajeEnRango(f, rango) : creacionEnRango(f, rango)) &&
      (estadosActivos.length === 0 || estadosActivos.includes(f.estado)) &&
      (tipo === 'todos' || tipoDeFila(f) === tipo),
  );

  const revisar = useCallback(async (id: number) => {
    setRevisandoId(id);
    setDetalle(null);
    setComentario('');
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

  async function aprobar() {
    if (revisandoId === null || accionando) return;
    setAccionando(true);
    try {
      const res = await aprobacionesApi.autorizar(revisandoId);
      if (res.data.success) {
        toast.success(res.data.message ?? `Solicitud ${revisandoId} autorizada.`);
        setFilas((fs) => fs.map((f) => (f.id_solicitud === revisandoId ? { ...f, estado: 'autorizada' } : f)));
        cerrarRevision();
      } else toast.error(res.data.message ?? 'No se pudo autorizar.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo autorizar.');
    } finally {
      setAccionando(false);
    }
  }

  async function rechazar() {
    if (revisandoId === null || accionando || comentario.trim() === '') return;
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

  // Encabezado del documento: el filtro activo y cuántas filas lo componen.
  // La gerencia se toma de las filas visibles solo cuando todas coinciden; si
  // hay varias se declara "VARIAS" en vez de elegir una al azar.
  const gerencias = Array.from(new Set(visibles.map((v) => v.gerencia).filter((g) => g !== '')));
  const gerenciaDocumento = gerencias.length === 1 ? gerencias[0] : gerencias.length > 1 ? 'VARIAS' : undefined;
  const tituloDocumento = `${ETIQUETA_FILTRO_FECHA[filtroFecha]} · ${visibles.length} ${
    visibles.length === 1 ? 'solicitud' : 'solicitudes'
  }`;

  const columnas = useMemo<ColumnDef<SolicitudBandeja>[]>(
    () => [
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
          <TooltipProvider delayDuration={150}>
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Revisar"
                    onClick={(evento) => {
                      evento.stopPropagation();
                      void revisar(row.original.id_solicitud);
                    }}
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Revisar</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        ),
      },
    ],
    [revisar],
  );

  return (
    <div className="space-y-4">
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
          {filtroFecha === 'personalizado' && !rango ? (
            <p className="text-xs text-muted-foreground">Elige la fecha inicial y la final para aplicar el rango.</p>
          ) : null}
          {!veTodos ? (
            <p role="note" className="text-xs text-muted-foreground">
              Sin el permiso de revisión global solo ves tus propias solicitudes (recorte del servidor):
              este concentrado no puede mostrar las de todos en producción.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <DataTable
        columns={columnas}
        data={visibles}
        title="Concentrado de viáticos"
        subtitle={`Total: ${visibles.length}`}
        pagination
        pageSize={10}
        height={460}
        loading={cargando}
        showRefreshButton
        onRefresh={() => { void cargar(); }}
        showExportButton
        exportLabel="Generar documento"
        onExport={() => setDocumentoAbierto(true)}
        filterConfig={{
          tableId: 'viaticos-concentrado-v1',
          searchableColumns: ['destino', 'solicitante', 'estado'],
          defaultSearchColumns: ['destino'],
          defaultVisibleColumns: [
            'solicitud',
            'periodo',
            'destino',
            'fechas',
            'transporte',
            'costo',
            'solicitante',
            'estado',
            'acciones',
          ],
        }}
        rowTestId={(fila) => `concentrado-${fila.id_solicitud}`}
        onRowClick={(fila) => { void revisar(fila.id_solicitud); }}
      />

      <ConcentradoDocumentoPreview
        abierto={documentoAbierto}
        solicitudes={visibles.map(filaConcentrado)}
        titulo={tituloDocumento}
        gerencia={gerenciaDocumento}
        onCerrar={() => setDocumentoAbierto(false)}
      />

      <Dialog
        open={revisandoId !== null}
        onOpenChange={(abierto) => {
          if (!abierto) cerrarRevision();
        }}
      >
        <DialogContent data-testid="revision-solicitud" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisión de la solicitud #{revisandoId}</DialogTitle>
            <DialogDescription>
              Se autoriza la opción elegida por la persona viajera, nunca un reemplazo elegido en su nombre.
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle ? <p role="status">Cargando revisión…</p> : null}
          {detalle ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Registrada en el servidor el {detalle.fecha_creacion.slice(0, 10)}. La hora de cotización
                original no la expone el servidor: esta foto distingue lo elegido de las alternativas.
              </p>
              <ul className="space-y-2">
                {detalle.opciones.map((o) => (
                  <li key={o.id_opcion} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                    <span className="font-medium">{o.linea}</span>
                    <span>{precioTexto(o)}</span>
                    {o.fue_elegida ? (
                      <Badge>Elegida por la persona viajera</Badge>
                    ) : (
                      <Badge variant="outline">Alternativa descartada</Badge>
                    )}
                  </li>
                ))}
                {detalle.opciones.length === 0 ? <li className="text-sm">Sin opciones registradas.</li> : null}
              </ul>
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
            <Button type="button" size="sm" disabled={!esAutorizable || accionando} onClick={aprobar}>
              Aprobar la opción elegida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConcentradoPage;
