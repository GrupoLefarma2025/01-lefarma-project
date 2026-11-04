import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
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
import {
  crearIntegracion,
  listarIntegraciones,
  revocarIntegracion,
} from '../services/configuracionAdminApi';
import type { IntegracionCliente, IntegracionCreada } from '../types';
import { copiarAlPortapapeles } from '../snippets';
import {
  desdeDatetimeLocal,
  esCancelado,
  esConflicto,
  esErrorReintentable,
  formatearFecha,
  mensajeError,
  mensajeErrorCompleto,
} from '../utils';

interface IntegracionesPanelProps {
  /** Permiso `configuracion.api_keys`. Sin él no se debe renderizar el panel. */
  puedeGestionar: boolean;
}

function estadoIntegracion(integracion: IntegracionCliente): {
  etiqueta: string;
  clase: string;
  revocada: boolean;
} {
  const revocada = integracion.activo === false;
  if (revocada) {
    return { etiqueta: 'Revocada', clase: 'border-destructive/40 text-destructive', revocada: true };
  }
  if (integracion.fechaExpiracion) {
    const expira = new Date(integracion.fechaExpiracion);
    if (!Number.isNaN(expira.getTime()) && expira.getTime() < Date.now()) {
      return { etiqueta: 'Expirada', clase: 'border-amber-500/40 text-amber-600', revocada: false };
    }
  }
  return { etiqueta: 'Activa', clase: 'border-emerald-500/40 text-emerald-600', revocada: false };
}

export function IntegracionesPanel({ puedeGestionar }: IntegracionesPanelProps) {
  const [integraciones, setIntegraciones] = useState<IntegracionCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [crearAbierto, setCrearAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [expiracion, setExpiracion] = useState('');
  const [clavesTexto, setClavesTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  const [creada, setCreada] = useState<IntegracionCreada | null>(null);
  const [copiada, setCopiada] = useState(false);

  const [aRevocar, setARevocar] = useState<IntegracionCliente | null>(null);
  const [revocando, setRevocando] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const cargar = useCallback(async (signal?: AbortSignal) => {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarIntegraciones(signal);
      setIntegraciones(datos);
    } catch (err) {
      if (esCancelado(err)) return;
      setError(mensajeError(err, 'No se pudieron cargar los clientes de integración.'));
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const limpiarFormulario = () => {
    setNombre('');
    setExpiracion('');
    setClavesTexto('');
    setErrorCrear(null);
  };

  const abrirCrear = () => {
    limpiarFormulario();
    setCrearAbierto(true);
  };

  const crear = async () => {
    if (guardando) return;

    if (!nombre.trim()) {
      setErrorCrear('El nombre es obligatorio.');
      return;
    }

    if (expiracion) {
      const fecha = new Date(expiracion);
      if (Number.isNaN(fecha.getTime())) {
        setErrorCrear('La fecha de expiración no es válida.');
        return;
      }
      if (fecha.getTime() < Date.now()) {
        setErrorCrear('La fecha de expiración debe ser posterior a hoy.');
        return;
      }
    }

    const claves = clavesTexto
      .split(/[\n,]/)
      .map((clave) => clave.trim())
      .filter(Boolean);

    setGuardando(true);
    setErrorCrear(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const respuesta = await crearIntegracion(
        {
          nombre: nombre.trim(),
          ...(expiracion ? { fechaExpiracion: desdeDatetimeLocal(expiracion) } : {}),
          ...(claves.length > 0 ? { clavesPermitidas: claves } : {}),
        },
        controller.signal,
      );

      setCrearAbierto(false);
      limpiarFormulario();
      setCopiada(false);
      setCreada(respuesta);
      toast.success('Cliente de integración creado.');
      void cargar();
    } catch (err) {
      if (esCancelado(err)) return;
      const mensaje = mensajeErrorCompleto(err, 'No se pudo crear el cliente de integración.');
      setErrorCrear(mensaje);
      toast.error(mensaje, {
        description: esErrorReintentable(err)
          ? 'Recarga la lista antes de reintentar: la llave pudo haberse creado y no se vuelve a mostrar.'
          : undefined,
      });
    } finally {
      setGuardando(false);
    }
  };

  const copiarLlave = async () => {
    if (!creada) return;
    const copiado = await copiarAlPortapapeles(creada.llave);
    if (copiado) {
      setCopiada(true);
      toast.success('Llave copiada al portapapeles.');
    } else {
      toast.error('No se pudo copiar automáticamente. Selecciona el texto y cópialo.');
    }
  };

  const revocar = async () => {
    if (!aRevocar || revocando) return;

    setRevocando(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await revocarIntegracion(aRevocar.idIntegracion, controller.signal);
      setARevocar(null);
      toast.success('Cliente revocado.', {
        description: 'Su llave dejó de funcionar de inmediato.',
      });
      void cargar();
    } catch (err) {
      if (esCancelado(err)) return;
      if (esConflicto(err)) {
        setARevocar(null);
        toast.error('El cliente ya fue modificado por otra persona.');
        void cargar();
        return;
      }
      toast.error(mensajeError(err, 'No se pudo revocar el cliente.'));
    } finally {
      setRevocando(false);
    }
  };

  if (!puedeGestionar) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Clientes de integración</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Genera llaves para que sistemas externos consuman las variables marcadas con destino{' '}
            <strong>Integraciones</strong>. La llave completa se muestra una sola vez.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void cargar()}>
            <RefreshCw className="h-4 w-4" />
            Recargar
          </Button>
          <Button type="button" size="sm" onClick={abrirCrear}>
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      <details open className="rounded-xl border border-indigo-200 bg-indigo-50/30">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-indigo-950">
          Cómo usar una integración
        </summary>
        <div className="grid gap-4 border-t border-indigo-200/70 p-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Una integración permite que un sistema externo lea variables globales sin usar el
              frontend de Lefarma. Solo se entregan las variables activas que tengan marcado el
              destino <strong>Integraciones</strong>.
            </p>
            <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
              <li>Crea o edita una variable y activa el destino Integraciones.</li>
              <li>Crea un cliente aquí y guarda la llave completa; se muestra una sola vez.</li>
              <li>Envía la llave en el encabezado <code className="font-mono">X-API-Key</code>.</li>
              <li>Si la llave se compromete, revócala: deja de funcionar de inmediato.</li>
            </ol>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline" className="font-mono text-[10px]">
                GET /api/configuracion/integraciones/variables/&#123;clave&#125;
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                POST /api/configuracion/integraciones/variables/consultar
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-indigo-900">Ejemplo cURL</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[10px] leading-relaxed text-slate-100">
{`curl --request GET \\
  --url "${typeof window === 'undefined' ? 'https://tu-servidor' : window.location.origin}/api/configuracion/integraciones/variables/pagos.terminal" \\
  --header "X-API-Key: $LEFARMA_CONFIG_API_KEY"`}
            </pre>
            <p className="text-[10px] text-muted-foreground">
              Respuesta: <code>{`{ clave, tipoDato, valor, revision }`}</code>. El ejemplo cURL de
              cada variable está disponible en el botón Copiar de la pestaña Variables.
            </p>
          </div>
        </div>
      </details>

      <div className="rounded-lg border border-border bg-card">
        {cargando && integraciones.length === 0 ? (
          <InlineLoader message="Cargando clientes…" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
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
        ) : integraciones.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-10 w-10" />}
            title="Sin clientes de integración"
            description="Crea el primero para emitir una llave de acceso."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Llave</TableHead>
                  <TableHead>Claves permitidas</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="w-[70px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integraciones.map((integracion) => {
                  const estado = estadoIntegracion(integracion);
                  const claves = integracion.clavesPermitidas ?? [];

                  return (
                    <TableRow key={integracion.idIntegracion}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{integracion.nombre}</span>
                          <span className="text-[11px] text-muted-foreground">
                            #{integracion.idIntegracion}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                          {integracion.prefijoLlave}••••••••
                        </code>
                      </TableCell>
                      <TableCell>
                        {claves.length > 0 ? (
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {claves.slice(0, 3).map((clave) => (
                              <Badge key={clave} variant="outline" className="text-[10px]">
                                {clave}
                              </Badge>
                            ))}
                            {claves.length > 3 && (
                              <Badge variant="secondary" className="text-[10px]">
                                +{claves.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Todas</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {integracion.fechaExpiracion
                          ? formatearFecha(integracion.fechaExpiracion, true)
                          : 'Sin expiración'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={estado.clase}>
                          {estado.etiqueta}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatearFecha(integracion.fechaCreacion, true)}
                      </TableCell>
                      <TableCell className="text-right">
                        {estado.revocada ? (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => setARevocar(integracion)}
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            Revocar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Crear cliente */}
      <Modal
        id="modal-crear-integracion"
        open={crearAbierto}
        setOpen={(abierto) => {
          if (!guardando) setCrearAbierto(abierto);
        }}
        title="Nuevo cliente de integración"
        subtitle="Se emitirá una llave de acceso que solo se mostrará una vez."
        size="md"
        beforeClose={() => !guardando}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => setCrearAbierto(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={crear} disabled={guardando}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {guardando ? 'Generando…' : 'Generar llave'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="integracion-nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="integracion-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Portal de proveedores"
              maxLength={150}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="integracion-expira">Fecha de expiración (opcional)</Label>
            <Input
              id="integracion-expira"
              type="datetime-local"
              value={expiracion}
              onChange={(e) => setExpiracion(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Si se deja vacía, la llave no expira por tiempo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="integracion-claves">Claves permitidas (opcional)</Label>
            <Textarea
              id="integracion-claves"
              value={clavesTexto}
              onChange={(e) => setClavesTexto(e.target.value)}
              placeholder={'Una por línea o separadas por coma\nej. viaticos.diasLimite'}
              className="min-h-[90px] font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Claves exactas o prefijos terminados en <code>*</code>. Déjalo vacío para permitir
              todas las variables con destino Integraciones.
            </p>
          </div>

          {errorCrear && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{errorCrear}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Llave recién creada */}
      <Modal
        id="modal-llave-integracion"
        open={creada !== null}
        setOpen={(abierto) => {
          if (!abierto) {
            setCreada(null);
            setCopiada(false);
          }
        }}
        title="Llave generada"
        subtitle="Esta es la única vez que se mostrará la llave completa."
        size="md"
        canClose={false}
        beforeClose={() => false}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreada(null);
                setCopiada(false);
              }}
            >
              Cerrar
            </Button>
            <Button type="button" onClick={copiarLlave}>
              <Copy className="h-4 w-4" />
              {copiada ? 'Copiada' : 'Copiar llave'}
            </Button>
          </div>
        }
      >
        {creada && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Guarda la llave en un lugar seguro <strong>ahora</strong>. No se volverá a mostrar
                y no puede recuperarse después de cerrar esta ventana.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cliente</Label>
                <span className="text-xs text-muted-foreground">
                  {creada.nombre} · prefijo {creada.prefijoLlave}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={creada.llave} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copiarLlave}>
                  {copiada ? (
                    <Copy className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="sr-only">Copiar llave</span>
                </Button>
              </div>
              {creada.fechaExpiracion && (
                <p className="text-[11px] text-muted-foreground">
                  Expira: {formatearFecha(creada.fechaExpiracion, true)}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Revocar */}
      <AlertDialog
        open={aRevocar !== null}
        onOpenChange={(abierto) => {
          if (!abierto && !revocando) setARevocar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Revocar el cliente «{aRevocar?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Su llave dejará de funcionar de inmediato para todos los sistemas externos. Esta
              acción no se puede deshacer y no elimina el registro del cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revocando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revocando}
              onClick={(event) => {
                event.preventDefault();
                void revocar();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revocando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {revocando ? 'Revocando…' : 'Revocar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nota de seguridad permanente */}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldOff className="h-3 w-3" />
        Revocar una llave no borra el cliente: conserva su historial para auditoría.
      </p>
    </div>
  );
}
