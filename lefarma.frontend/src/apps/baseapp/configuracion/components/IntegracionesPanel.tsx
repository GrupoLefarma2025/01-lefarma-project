import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  listarVariables,
  revocarIntegracion,
} from '../services/configuracionAdminApi';
import type { IntegracionCliente, IntegracionCreada, ModuloConfig } from '../types';
import { copiarAlPortapapeles } from '../snippets';
import {
  esCancelado,
  esConflicto,
  esErrorReintentable,
  formatearFecha,
  mensajeError,
  mensajeErrorCompleto,
  moduloDeClave,
  namespaceDeClave,
  patronesAlcanceIntegracion,
} from '../utils';

interface IntegracionesPanelProps {
  puedeGestionar: boolean;
  modulos: ModuloConfig[];
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

const SIN_FILTRO = '__todos__';

type ModoExpiracion = 'nunca' | '1' | '7' | '30' | '90' | 'personalizado';

const DIAS_MAXIMOS_EXPIRACION = 3650;

interface VariableIntegracion {
  clave: string;
  nombre: string;
  modulo: string | null;
  namespace: string;
}

function namespacesDeAlcance(
  variables: VariableIntegracion[],
  modulo: string,
): string[] {
  const base =
    modulo === SIN_FILTRO ? variables : variables.filter((variable) => variable.modulo === modulo);
  return Array.from(new Set(base.map((variable) => variable.namespace))).sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
}

function clavesDeAlcance(
  variables: VariableIntegracion[],
  modulo: string,
  namespace: string,
): VariableIntegracion[] {
  return variables.filter(
    (variable) =>
      (modulo === SIN_FILTRO || variable.modulo === modulo) &&
      (namespace === SIN_FILTRO || variable.namespace === namespace),
  );
}

function fechaExpiracionDesdeDias(dias: number): string {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
}

export function IntegracionesPanel({ puedeGestionar, modulos }: IntegracionesPanelProps) {
  const [integraciones, setIntegraciones] = useState<IntegracionCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [crearAbierto, setCrearAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [modoExpiracion, setModoExpiracion] = useState<ModoExpiracion>('90');
  const [diasExpiracion, setDiasExpiracion] = useState('30');
  const [moduloSeleccionado, setModuloSeleccionado] = useState(SIN_FILTRO);
  const [namespaceSeleccionado, setNamespaceSeleccionado] = useState(SIN_FILTRO);
  const [claveSeleccionada, setClaveSeleccionada] = useState(SIN_FILTRO);
  const [variablesIntegracion, setVariablesIntegracion] = useState<VariableIntegracion[]>([]);
  const [cargandoVariables, setCargandoVariables] = useState(true);
  const [errorVariables, setErrorVariables] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  const [creada, setCreada] = useState<IntegracionCreada | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [mostrarRevocadas, setMostrarRevocadas] = useState(false);

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
    const controller = new AbortController();

    void (async () => {
      setCargandoVariables(true);
      setErrorVariables(null);
      try {
        const variables = await listarVariables(
          { destino: 'integraciones', activo: true },
          controller.signal,
        );
        setVariablesIntegracion(
          variables
            .map((variable) => ({
              clave: variable.clave,
              nombre: variable.nombre,
              modulo: moduloDeClave(variable.clave),
              namespace: namespaceDeClave(variable.clave),
            }))
            .sort((a, b) => a.clave.localeCompare(b.clave)),
        );
      } catch (err) {
        if (esCancelado(err)) return;
        setErrorVariables(
          mensajeError(err, 'No se pudieron cargar las variables disponibles para integraciones.'),
        );
      } finally {
        if (!controller.signal.aborted) setCargandoVariables(false);
      }
    })();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const modulosDisponibles = useMemo(() => {
    const claves = Array.from(
      new Set(
        variablesIntegracion
          .map((variable) => variable.modulo)
          .filter((modulo): modulo is string => modulo !== null),
      ),
    );
    const nombres = new Map(modulos.map((modulo) => [modulo.clave, modulo.nombre]));
    return claves
      .map((clave) => ({ clave, nombre: nombres.get(clave) ?? clave }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [variablesIntegracion, modulos]);

  const namespacesDisponibles = useMemo(
    () => namespacesDeAlcance(variablesIntegracion, moduloSeleccionado),
    [variablesIntegracion, moduloSeleccionado],
  );

  const clavesDisponibles = useMemo(
    () => clavesDeAlcance(variablesIntegracion, moduloSeleccionado, namespaceSeleccionado),
    [variablesIntegracion, moduloSeleccionado, namespaceSeleccionado],
  );

  const diasSeleccionados =
    modoExpiracion === 'personalizado'
      ? Number(diasExpiracion)
      : modoExpiracion === 'nunca'
        ? null
        : Number(modoExpiracion);

  const diasValidos =
    diasSeleccionados === null ||
    (Number.isInteger(diasSeleccionados) &&
      diasSeleccionados >= 1 &&
      diasSeleccionados <= DIAS_MAXIMOS_EXPIRACION);

  const fechaExpiracionPreview =
    diasSeleccionados !== null && diasValidos
      ? fechaExpiracionDesdeDias(diasSeleccionados)
      : null;

  const patronesAlcance = useMemo(
    () =>
      patronesAlcanceIntegracion(
        variablesIntegracion,
        moduloSeleccionado === SIN_FILTRO ? null : moduloSeleccionado,
        namespaceSeleccionado === SIN_FILTRO ? null : namespaceSeleccionado,
        claveSeleccionada === SIN_FILTRO ? null : claveSeleccionada,
      ),
    [variablesIntegracion, moduloSeleccionado, namespaceSeleccionado, claveSeleccionada],
  );

  const cambiarModulo = (valor: string) => {
    const namespacesNuevos = namespacesDeAlcance(variablesIntegracion, valor);
    const namespaceEfectivo =
      namespaceSeleccionado !== SIN_FILTRO && namespacesNuevos.includes(namespaceSeleccionado)
        ? namespaceSeleccionado
        : SIN_FILTRO;

    setModuloSeleccionado(valor);
    if (namespaceEfectivo !== namespaceSeleccionado) setNamespaceSeleccionado(namespaceEfectivo);

    if (
      claveSeleccionada !== SIN_FILTRO &&
      !clavesDeAlcance(variablesIntegracion, valor, namespaceEfectivo).some(
        (variable) => variable.clave === claveSeleccionada,
      )
    ) {
      setClaveSeleccionada(SIN_FILTRO);
    }
  };

  const cambiarNamespace = (valor: string) => {
    setNamespaceSeleccionado(valor);
    if (
      claveSeleccionada !== SIN_FILTRO &&
      !clavesDeAlcance(variablesIntegracion, moduloSeleccionado, valor).some(
        (variable) => variable.clave === claveSeleccionada,
      )
    ) {
      setClaveSeleccionada(SIN_FILTRO);
    }
  };

  const limpiarFormulario = () => {
    setNombre('');
    setModoExpiracion('90');
    setDiasExpiracion('30');
    setModuloSeleccionado(SIN_FILTRO);
    setNamespaceSeleccionado(SIN_FILTRO);
    setClaveSeleccionada(SIN_FILTRO);
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

    if (!diasValidos) {
      setErrorCrear(
        `Los días de expiración deben ser un entero entre 1 y ${DIAS_MAXIMOS_EXPIRACION}.`,
      );
      return;
    }

    const fechaExpiracion =
      diasSeleccionados === null ? null : fechaExpiracionDesdeDias(diasSeleccionados);

    setGuardando(true);
    setErrorCrear(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const respuesta = await crearIntegracion(
        {
          nombre: nombre.trim(),
          ...(fechaExpiracion ? { fechaExpiracion } : {}),
          ...(patronesAlcance.length > 0 ? { clavesPermitidas: patronesAlcance } : {}),
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

  const activas = integraciones.filter((integracion) => integracion.activo !== false);
  const visibles = mostrarRevocadas ? integraciones : activas;

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
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 text-xs">
            <Checkbox
              checked={mostrarRevocadas}
              onCheckedChange={(marcado) => setMostrarRevocadas(marcado === true)}
              aria-label="Mostrar también las integraciones revocadas"
            />
            <span>Mostrar revocadas</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {integraciones.length - activas.length}
            </span>
          </label>
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
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-10 w-10" />}
            title={mostrarRevocadas ? 'Sin clientes de integración' : 'Sin integraciones activas'}
            description={
              mostrarRevocadas
                ? 'Crea el primero para emitir una llave de acceso.'
                : integraciones.length > 0
                  ? 'Marca «Mostrar revocadas» para consultar el historial.'
                  : 'Crea el primero para emitir una llave de acceso.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Llave</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="w-[70px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((integracion) => {
                  const estado = estadoIntegracion(integracion);
                  const alcance = integracion.clavesPermitidas ?? [];

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
                        {alcance.length > 0 ? (
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {alcance.slice(0, 3).map((patron) => (
                              <Badge key={patron} variant="outline" className="text-[10px]">
                                {patron}
                              </Badge>
                            ))}
                            {alcance.length > 3 && (
                              <Badge variant="secondary" className="text-[10px]">
                                +{alcance.length - 3}
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

      {}
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
            <Label htmlFor="integracion-expira">Expiración</Label>
            <Select
              value={modoExpiracion}
              onValueChange={(valor) => setModoExpiracion(valor as ModoExpiracion)}
              disabled={guardando}
            >
              <SelectTrigger id="integracion-expira" aria-label="Expiración de la llave">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nunca">Nunca</SelectItem>
                <SelectItem value="1">1 día</SelectItem>
                <SelectItem value="7">7 días</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {modoExpiracion === 'personalizado' && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="integracion-dias">Días para expirar</Label>
                <Input
                  id="integracion-dias"
                  type="number"
                  min={1}
                  max={DIAS_MAXIMOS_EXPIRACION}
                  step={1}
                  value={diasExpiracion}
                  onChange={(e) => setDiasExpiracion(e.target.value)}
                  disabled={guardando}
                />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              {fechaExpiracionPreview
                ? `La llave expirará el ${formatearFecha(fechaExpiracionPreview, true)}.`
                : modoExpiracion === 'nunca'
                  ? 'La llave no expira por tiempo.'
                  : 'Indica cuántos días debe durar la llave.'}
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Alcance de la llave</p>
              <p className="text-[11px] text-muted-foreground">
                Opcional. Sin módulo, namespace ni clave, la llave podrá leer todas las variables
                activas con destino Integraciones.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="integracion-modulo">Módulo</Label>
                <Select
                  value={moduloSeleccionado}
                  onValueChange={cambiarModulo}
                  disabled={cargandoVariables || guardando || modulosDisponibles.length === 0}
                >
                  <SelectTrigger id="integracion-modulo" aria-label="Módulo del alcance">
                    <SelectValue placeholder={cargandoVariables ? 'Cargando…' : 'Ninguno'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_FILTRO}>Ninguno</SelectItem>
                    {modulosDisponibles.map((modulo) => (
                      <SelectItem key={modulo.clave} value={modulo.clave}>
                        {modulo.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="integracion-namespace">Namespace</Label>
                <Select
                  value={namespaceSeleccionado}
                  onValueChange={cambiarNamespace}
                  disabled={cargandoVariables || guardando || namespacesDisponibles.length === 0}
                >
                  <SelectTrigger id="integracion-namespace" aria-label="Namespace del alcance">
                    <SelectValue placeholder={cargandoVariables ? 'Cargando…' : 'Ninguno'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_FILTRO}>Ninguno</SelectItem>
                    {namespacesDisponibles.map((namespace) => (
                      <SelectItem key={namespace} value={namespace}>
                        {namespace}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="integracion-clave">Clave</Label>
              <Select
                value={claveSeleccionada}
                onValueChange={setClaveSeleccionada}
                disabled={cargandoVariables || guardando || clavesDisponibles.length === 0}
              >
                <SelectTrigger id="integracion-clave" aria-label="Clave del alcance">
                  <SelectValue placeholder={cargandoVariables ? 'Cargando…' : 'Ninguna'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_FILTRO}>Ninguna</SelectItem>
                  {clavesDisponibles.map((variable) => (
                    <SelectItem key={variable.clave} value={variable.clave}>
                      {variable.clave} · {variable.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {errorVariables && (
              <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {errorVariables}
              </p>
            )}

            <div className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px]">
              <span className="font-medium text-foreground">Alcance resultante: </span>
              {patronesAlcance.length === 0 ? (
                <span className="text-muted-foreground">
                  todas las variables activas con destino Integraciones.
                </span>
              ) : (
                <span className="inline-flex flex-wrap gap-1">
                  {patronesAlcance.map((patron) => (
                    <code
                      key={patron}
                      className="rounded bg-background px-1 py-0.5 font-mono text-[10px]"
                    >
                      {patron}
                    </code>
                  ))}
                </span>
              )}
            </div>
          </div>

          {errorCrear && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{errorCrear}</p>
            </div>
          )}
        </div>
      </Modal>

      {}
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

      {}
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

      {}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldOff className="h-3 w-3" />
        Revocar una llave no borra el cliente: conserva su historial para auditoría.
      </p>
    </div>
  );
}
