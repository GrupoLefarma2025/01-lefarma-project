import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  History,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/ui/inline-loader';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  listarHistorial,
  obtenerEntradaHistorial,
  restaurarVariable,
} from '../services/configuracionAdminApi';
import type {
  BitacoraDetalle,
  BitacoraVariable,
  VariableConfiguracion,
} from '../types';
import {
  calcularDiff,
  esCancelado,
  esConflicto,
  esErrorReintentable,
  etiquetaAccion,
  fechaBitacora,
  formatearFecha,
  jsonATexto,
  mensajeError,
  nuevoIdOperacion,
} from '../utils';

interface HistoryDialogProps {
  variable: VariableConfiguracion;
  puedeRestaurar: boolean;
  onClose: () => void;
  onRestored: () => void;
  onConflicto: () => void;
}

const COLOR_ACCION: Record<string, string> = {
  Creación: 'bg-emerald-500',
  Actualización: 'bg-sky-500',
  Desactivación: 'bg-amber-500',
  Reactivación: 'bg-emerald-500',
  Restauración: 'bg-violet-500',
};

function colorAccion(accion: string): string {
  return COLOR_ACCION[etiquetaAccion(accion)] ?? 'bg-slate-400';
}

export function HistoryDialog({
  variable,
  puedeRestaurar,
  onClose,
  onRestored,
  onConflicto,
}: HistoryDialogProps) {
  const [entradas, setEntradas] = useState<BitacoraVariable[]>([]);
  const [detalles, setDetalles] = useState<Record<number, BitacoraDetalle>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [intentoDetalle, setIntentoDetalle] = useState(0);
  const [aRestaurar, setARestaurar] = useState<BitacoraVariable | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  const idOperacionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      setCargando(true);
      setError(null);
      try {
        const datos = await listarHistorial(variable.idVariable, signal);
        const ordenadas = [...datos].sort(
          (a, b) => new Date(fechaBitacora(b)).getTime() - new Date(fechaBitacora(a)).getTime(),
        );
        setEntradas(ordenadas);
        setSeleccionada(ordenadas[0]?.idBitacora ?? null);
      } catch (err) {
        if (esCancelado(err)) return;
        setError(mensajeError(err, 'No se pudo cargar el historial.'));
      } finally {
        if (!signal?.aborted) setCargando(false);
      }
    },
    [variable.idVariable],
  );

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    void cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  // El listado devuelve resúmenes; el detalle (snapshots) se pide por entrada.
  useEffect(() => {
    if (seleccionada === null) return;

    const resumen = entradas.find((item) => item.idBitacora === seleccionada);
    const yaTieneDatos = resumen?.datosNuevos !== undefined;
    if (yaTieneDatos || detalles[seleccionada]) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setCargandoDetalle(true);
    setErrorDetalle(null);

    (async () => {
      try {
        const detalle = await obtenerEntradaHistorial(
          variable.idVariable,
          seleccionada,
          controller.signal,
        );
        setDetalles((actual) => ({ ...actual, [seleccionada]: detalle }));
      } catch (err) {
        if (esCancelado(err)) return;
        setErrorDetalle(mensajeError(err, 'No se pudo cargar el detalle de la versión.'));
      } finally {
        if (!controller.signal.aborted) setCargandoDetalle(false);
      }
    })();

    return () => controller.abort();
  }, [seleccionada, entradas, detalles, intentoDetalle, variable.idVariable]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const resumen = entradas.find((item) => item.idBitacora === seleccionada) ?? null;
  const detalle = seleccionada !== null ? detalles[seleccionada] : undefined;
  const entrada: BitacoraVariable | null = detalle ?? resumen;
  const datosDisponibles = entrada?.datosNuevos !== undefined;
  const diff = datosDisponibles && entrada ? calcularDiff(entrada.datosAnteriores, entrada.datosNuevos) : [];
  const esInicial =
    (entrada?.accion ?? '').toLowerCase() === 'crear' ||
    (datosDisponibles && entrada?.datosAnteriores == null);

  const confirmarRestauracion = async () => {
    if (!aRestaurar || restaurando) return;

    setRestaurando(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const idOperacion = idOperacionRef.current ?? nuevoIdOperacion();
    idOperacionRef.current = idOperacion;

    try {
      await restaurarVariable(
        variable.idVariable,
        {
          idBitacoraOrigen: aRestaurar.idBitacora,
          versionEsperada: variable.version,
          idOperacion,
        },
        controller.signal,
      );
      idOperacionRef.current = null;
      setARestaurar(null);
      toast.success('Versión restaurada.', {
        description: 'Se creó una nueva versión; el historial anterior se conserva.',
      });
      onRestored();
    } catch (err) {
      if (esCancelado(err)) return;

      if (esConflicto(err)) {
        idOperacionRef.current = null;
        setARestaurar(null);
        toast.error('Otra persona modificó esta variable.', {
          description: 'Se recargaron los datos con la versión más reciente.',
        });
        onConflicto();
        return;
      }

      const mensaje = mensajeError(err, 'No se pudo restaurar la versión.');
      toast.error(mensaje, {
        description: esErrorReintentable(err)
          ? 'Pudo ser un timeout. Reintenta: se reutilizará el mismo identificador de operación.'
          : undefined,
      });
      if (!esErrorReintentable(err)) idOperacionRef.current = null;
    } finally {
      setRestaurando(false);
      abortRef.current = null;
    }
  };

  return (
    <>
      <Modal
        id="modal-historial-variable"
        open
        setOpen={(abierto) => {
          if (!abierto) onClose();
        }}
        title="Historial de cambios"
        subtitle={
          <span className="font-mono text-xs">
            {variable.nombre} · {variable.clave}
          </span>
        }
        size="full"
        beforeClose={() => !restaurando}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Restaurar no borra el historial: crea una nueva versión a partir de la elegida.
            </p>
            <Button type="button" variant="outline" onClick={onClose} disabled={restaurando}>
              Cerrar
            </Button>
          </div>
        }
      >
        {cargando ? (
          <InlineLoader message="Cargando historial…" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">
                Verifica la conexión e inténtalo de nuevo.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void cargar()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </div>
        ) : entradas.length === 0 ? (
          <EmptyState
            icon={<History className="h-10 w-10" />}
            title="Sin historial"
            description="Esta variable todavía no tiene cambios registrados."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            {/* Timeline */}
            <div className="lg:max-h-[65vh] lg:overflow-y-auto lg:pr-1">
              <ol className="relative space-y-1 border-l border-border pl-4">
                {entradas.map((item) => {
                  const activa = item.idBitacora === seleccionada;
                  const accion = etiquetaAccion(item.accion);
                  return (
                    <li key={item.idBitacora} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                          colorAccion(item.accion),
                        )}
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setErrorDetalle(null);
                          setSeleccionada(item.idBitacora);
                        }}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                          activa
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-transparent hover:border-border hover:bg-muted/50',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{accion}</span>
                          <Badge variant="outline" className="text-[10px]">
                            #{item.idBitacora}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatearFecha(fechaBitacora(item), true)}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <User className="h-3 w-3" />
                          {item.idUsuario ? `Usuario #${item.idUsuario}` : 'Sistema'}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Detalle */}
            <div className="min-w-0 space-y-3 lg:max-h-[65vh] lg:overflow-y-auto lg:pr-1">
              {entrada && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{etiquetaAccion(entrada.accion)}</Badge>
                        <span className="text-sm font-medium">
                          Cambio #{entrada.idBitacora}
                        </span>
                      </div>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatearFecha(fechaBitacora(entrada), true)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entrada.idUsuario ? `Usuario #${entrada.idUsuario}` : 'Sistema'}
                        </span>
                        {entrada.idOperacion && (
                          <span className="font-mono">
                            op {entrada.idOperacion.slice(0, 8)}…
                          </span>
                        )}
                      </p>
                    </div>

                    {entrada.idBitacoraOrigen != null && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <RotateCcw className="h-3 w-3" />
                        Restaurada de #{entrada.idBitacoraOrigen}
                      </Badge>
                    )}
                  </div>

                  {!datosDisponibles ? (
                    cargandoDetalle ? (
                      <InlineLoader message="Cargando detalle de la versión…" />
                    ) : errorDetalle ? (
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-6 text-center">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                        <p className="text-xs text-destructive">{errorDetalle}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setIntentoDetalle((valor) => valor + 1)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reintentar detalle
                        </Button>
                      </div>
                    ) : null
                  ) : esInicial ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-medium">Versión inicial</p>
                      <p className="text-[11px] text-muted-foreground">
                        Aquí se creó la variable. Restaurarla vuelve a aplicar sus valores
                        originales como una nueva versión.
                      </p>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-2 font-mono text-[11px]">
                        {jsonATexto(entrada.datosNuevos)}
                      </pre>
                    </div>
                  ) : diff.length === 0 ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        Esta versión no presenta diferencias en los campos del registro.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {diff.map((cambio, indice) => (
                        <div
                          key={`${cambio.ruta}-${indice}`}
                          className="rounded-lg border border-border bg-card"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                            <span className="text-xs font-medium">{cambio.ruta}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                cambio.tipo === 'agregado' &&
                                  'border-emerald-500/40 text-emerald-600',
                                cambio.tipo === 'eliminado' &&
                                  'border-destructive/40 text-destructive',
                              )}
                            >
                              {cambio.tipo === 'agregado'
                                ? 'Agregado'
                                : cambio.tipo === 'eliminado'
                                  ? 'Eliminado'
                                  : 'Cambio'}
                            </Badge>
                          </div>
                          <div className="grid gap-px bg-border sm:grid-cols-2">
                            <div className="bg-background p-2.5">
                              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Antes
                              </p>
                              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                                {cambio.antes}
                              </pre>
                            </div>
                            <div className="bg-background p-2.5">
                              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Después
                              </p>
                              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                                {cambio.despues}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2.5">
                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Se restaurará el contenido de esta versión como una <strong>nueva</strong>{' '}
                        versión.
                      </span>
                    </div>

                    {puedeRestaurar ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!datosDisponibles || restaurando}
                        onClick={() => setARestaurar(entrada)}
                        title={
                          !datosDisponibles
                            ? 'Espera a que cargue el detalle de la versión'
                            : undefined
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restaurar versión
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Sin permiso para restaurar
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <AlertDialog
        open={aRestaurar !== null}
        onOpenChange={(abierto) => {
          if (!abierto && !restaurando) setARestaurar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Restaurar el cambio #{aRestaurar?.idBitacora}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se creará una nueva versión de <strong>{variable.nombre}</strong> con los valores de
              esa entrada. El historial no se borra y la versión actual queda registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restaurando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={restaurando}
              onClick={(event) => {
                event.preventDefault();
                void confirmarRestauracion();
              }}
            >
              {restaurando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {restaurando ? 'Restaurando…' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
