import { useEffect, useState, useMemo } from 'react';
import { API } from '@/services/api';
import type { ApiResponse } from '@/types/api.types';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import { EnvioConcentradoPDF, AGRUPACION_LABELS } from '@/components/ordenes/EnvioConcentradoPDF';
import type { AgrupacionKey } from '@/components/ordenes/EnvioConcentradoPDF';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Printer, Send, RefreshCw, LayoutGrid, CheckSquare, Square, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toApiError } from '@/utils/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvioConcentradoItemResult {
  idOrden: number;
  folio: string;
  exitoso: boolean;
  nuevoEstado?: string;
  error?: string;
}

interface EnvioConcentradoResponse {
  total: number;
  exitosas: number;
  fallidas: number;
  resultados: EnvioConcentradoItemResult[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function getGroupLabel(orden: OrdenCompraResponse, agrupacion: AgrupacionKey): string {
  switch (agrupacion) {
    case 'sucursal':
      return orden.sucursalNombre ?? `Sucursal ${orden.idSucursal}`;
    case 'empresa':
      return orden.empresaNombre ?? `Empresa ${orden.idEmpresa}`;
    case 'area':
      return orden.areaNombre ?? `Área ${orden.idArea}`;
    case 'proveedor':
      return orden.idProveedor ? `Proveedor ${orden.idProveedor}` : 'Sin proveedor';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const AGRUPACIONES: Array<{ value: AgrupacionKey; label: string }> = [
  { value: 'sucursal', label: 'Sucursal' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'area', label: 'Área' },
  { value: 'proveedor', label: 'Proveedor' },
];

export default function EnvioConcentrado() {
  const { user } = useAuthStore();
  const [ordenes, setOrdenes] = useState<OrdenCompraResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [agrupacion, setAgrupacion] = useState<AgrupacionKey>('sucursal');
  const [enviando, setEnviando] = useState(false);
  const [envioResult, setEnvioResult] = useState<EnvioConcentradoResponse | null>(null);
  const [envioError, setEnvioError] = useState<string | null>(null);

  // ── Fetch órdenes pendientes de envío concentrado ────────────────────────
  // Estado PREPARACION_GAF (id_estado = 11) - paso que tiene envia_concentrado
  const ESTADO_ENVIO_CONCENTRADO = 11;

  const fetchOrdenes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get<ApiResponse<OrdenCompraResponse[]>>(
        `/ordenes?idEstado=${ESTADO_ENVIO_CONCENTRADO}&soloEnvioConcentrado=true`
      );
      setOrdenes(res.data.data ?? []);
    } catch {
      setError('No se pudieron cargar las órdenes pendientes de envío concentrado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdenes();
  }, []);

  // ── Selección ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === ordenes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ordenes.map((o) => o.idOrden)));
    }
  };

  const allSelected = ordenes.length > 0 && selected.size === ordenes.length;
  const someSelected = selected.size > 0 && !allSelected;

  // ── Órdenes seleccionadas para el PDF ────────────────────────────────────
  const ordenesSeleccionadas = useMemo(
    () => ordenes.filter((o) => selected.has(o.idOrden)),
    [ordenes, selected]
  );

  const totalSeleccionado = useMemo(
    () => ordenesSeleccionadas.reduce((s, o) => s + o.total, 0),
    [ordenesSeleccionadas]
  );

  // ── Grupos para la vista previa ───────────────────────────────────────────
  const grupos = useMemo(() => {
    const map = new Map<string, OrdenCompraResponse[]>();
    for (const o of ordenesSeleccionadas) {
      const key = getGroupLabel(o, agrupacion);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es-MX'))
      .map(([grupo, items]) => ({
        grupo,
        items,
        subtotal: items.reduce((s, o) => s + o.total, 0),
      }));
  }, [ordenesSeleccionadas, agrupacion]);

  // ── Imprimir PDF ─────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (ordenesSeleccionadas.length === 0) return;
    document.body.classList.remove('print-flujo', 'print-orden');
    document.body.classList.add('print-envio-concentrado');
    window.print();
    setTimeout(() => document.body.classList.remove('print-envio-concentrado'), 500);
  };

  // ── Enviar al Director ────────────────────────────────────────────────────
  const handleEnviar = async () => {
    if (ordenesSeleccionadas.length === 0) return;
    setEnviando(true);
    setEnvioResult(null);
    setEnvioError(null);
    try {
      const res = await API.post<ApiResponse<EnvioConcentradoResponse>>('/ordenes/envio-concentrado', {
        idsOrdenes: ordenesSeleccionadas.map((o) => o.idOrden),
        comentario: 'Enviado en lote desde Envío GAF',
      });
      const data = res.data.data!;
      setEnvioResult(data);
      // Recargar órdenes para reflejar los cambios de estado
      if (data.exitosas > 0) {
        setTimeout(fetchOrdenes, 800);
        setSelected(new Set());
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      setEnvioError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Envío Concentrado</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Selecciona las órdenes pendientes de envío concentrado, genera el concentrado PDF y envía al director
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrdenes}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* ── Resultado del envío ── */}
      {(envioResult || envioError) && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
            envioError
              ? 'border-destructive/40 bg-destructive/5 text-destructive'
              : envioResult?.fallidas === 0
              ? 'border-green-500/40 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'
              : 'border-yellow-500/40 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
          )}
        >
          {envioError ? (
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            {envioError ? (
              <span>{envioError}</span>
            ) : envioResult ? (
              <>
                <span className="font-medium">
                  {envioResult.exitosas} orden(es) avanzadas exitosamente
                  {envioResult.fallidas > 0 && `, ${envioResult.fallidas} con error`}.
                </span>
                {envioResult.fallidas > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {envioResult.resultados
                      .filter((r) => !r.exitoso)
                      .map((r) => (
                        <li key={r.idOrden}>
                          {r.folio}: {r.error}
                        </li>
                      ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
          <button
            onClick={() => { setEnvioResult(null); setEnvioError(null); }}
            className="text-current opacity-50 hover:opacity-100 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Layout principal: tabla izquierda + preview derecha ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Panel izquierdo: tabla ── */}
        <div className="flex flex-col gap-3 w-[55%] min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-3 bg-muted/40 border rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              Agrupar por:
            </div>
            <Select
              value={agrupacion}
              onValueChange={(v) => setAgrupacion(v as AgrupacionKey)}
            >
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGRUPACIONES.map((a) => (
                  <SelectItem key={a.value} value={a.value} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>{ordenes.length} órdenes disponibles</span>
              {selected.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selected.size} seleccionadas
                </Badge>
              )}
            </div>
          </div>

          {/* Tabla */}
          <div className="border rounded-lg overflow-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Cargando órdenes…
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-40 text-sm text-destructive">
                {error}
              </div>
            ) : ordenes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground gap-1">
                <span className="text-2xl">📋</span>
                <span>No hay órdenes pendientes de envío concentrado</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10">
                      <button
                        onClick={toggleAll}
                        className="flex items-center justify-center"
                        title={allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : someSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary opacity-50" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Folio</TableHead>
                    <TableHead className="text-xs font-semibold">
                      {AGRUPACION_LABELS[agrupacion]}
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Área</TableHead>
                    <TableHead className="text-xs font-semibold text-right">F. Límite</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((orden) => {
                    const isSelected = selected.has(orden.idOrden);
                    return (
                      <TableRow
                        key={orden.idOrden}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/8 hover:bg-primary/12'
                            : 'hover:bg-muted/40'
                        )}
                        onClick={() => toggleSelect(orden.idOrden)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(orden.idOrden)}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium">
                          {orden.folio}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getGroupLabel(orden, agrupacion)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {orden.areaNombre ?? `Área ${orden.idArea}`}
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {orden.fechaLimitePago ? fmtDate(orden.fechaLimitePago) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {fmtMoney(orden.total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Barra de totales seleccionados */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between border rounded-lg px-4 py-2.5 bg-primary/5 border-primary/20">
              <div className="text-sm">
                <span className="font-semibold text-primary">{selected.size}</span>
                <span className="text-muted-foreground ml-1">
                  {selected.size === 1 ? 'orden seleccionada' : 'órdenes seleccionadas'}
                </span>
              </div>
              <div className="text-sm font-bold text-primary">{fmtMoney(totalSeleccionado)}</div>
            </div>
          )}
        </div>

        {/* ── Panel derecho: vista previa ── */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Header del panel */}
          <div className="flex items-center justify-between bg-muted/40 border rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground">Vista previa del PDF</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={handlePrint}
                disabled={ordenesSeleccionadas.length === 0}
              >
                <Printer className="h-3.5 w-3.5" />
                Vista previa
              </Button>
              <Button
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={handleEnviar}
                disabled={ordenesSeleccionadas.length === 0 || enviando}
              >
                <Send className="h-3.5 w-3.5" />
                {enviando ? 'Procesando…' : 'Envar concentrado'}
              </Button>
            </div>
          </div>

          {/* Preview del documento */}
          <div className="flex-1 border rounded-lg overflow-auto bg-zinc-100 dark:bg-zinc-900 p-3">
            {ordenesSeleccionadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <div className="text-4xl opacity-30">📄</div>
                <span className="text-sm">
                  Selecciona órdenes para ver la vista previa del PDF
                </span>
                <span className="text-xs opacity-60">
                  Puedes cambiar la agrupación y ver cómo quedará el documento
                </span>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded overflow-hidden">
                {/* Resumen de grupos en preview */}
                <div className="p-4 border-b bg-slate-50 text-xs text-muted-foreground flex items-center gap-4">
                  <span>
                    <strong className="text-foreground">{grupos.length}</strong>{' '}
                    {grupos.length === 1 ? 'grupo' : 'grupos'} · agrupado por{' '}
                    <strong className="text-foreground">{AGRUPACION_LABELS[agrupacion]}</strong>
                  </span>
                  <span className="ml-auto font-semibold text-foreground">
                    Total: {fmtMoney(totalSeleccionado)}
                  </span>
                </div>
                {/* Grupos preview */}
                <div className="divide-y">
                  {grupos.map(({ grupo, items, subtotal }) => (
                    <div key={grupo} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {grupo}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {fmtMoney(subtotal)}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {items.map((o) => (
                          <div
                            key={o.idOrden}
                            className="flex items-center justify-between text-xs py-0.5 px-2 rounded bg-slate-50 border border-slate-100"
                          >
                            <span className="font-mono text-slate-700">{o.folio}</span>
                            <span className="text-slate-500">
                              {o.areaNombre ?? `Área ${o.idArea}`}
                            </span>
                            <span className="font-medium text-slate-800">
                              {fmtMoney(o.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Total general */}
                <div className="p-3 bg-slate-50 border-t flex justify-end">
                  <div className="text-sm font-bold text-slate-800">
                    Total general: {fmtMoney(totalSeleccionado)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Componente PDF oculto (solo se muestra al imprimir) ── */}
      <EnvioConcentradoPDF
        ordenes={ordenesSeleccionadas}
        agrupacion={agrupacion}
        generadoPor={user?.nombre ?? user?.username}
      />
    </div>
  );
}
