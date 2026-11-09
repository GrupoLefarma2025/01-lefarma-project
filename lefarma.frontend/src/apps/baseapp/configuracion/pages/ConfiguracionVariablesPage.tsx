import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Braces,
  Code2,
  Copy,
  Database,
  History,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Server,
  Settings2,
  SlidersHorizontal,
  SquareTerminal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissionVersion } from '@/utils/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  desactivarVariable,
  listarVariables,
  reactivarVariable,
} from '../services/configuracionAdminApi';
import {
  DESTINOS,
  PERMISOS_CONFIGURACION,
  TIPOS_DATO,
  type DestinoConfig,
  type VariableConfiguracion,
} from '../types';
import {
  claveOperacionEstado,
  esCancelado,
  esConflicto,
  esErrorReintentable,
  etiquetaTipo,
  formatearFecha,
  mensajeError,
  namespaceDeClave,
  namespacesDeVariables,
  nuevoIdOperacion,
  resumirValor,
  tienePermiso,
  tipoDatoBackend,
} from '../utils';
import { VariableEditorDialog } from '../components/VariableEditorDialog';
import { HistoryDialog } from '../components/HistoryDialog';
import { IntegracionesPanel } from '../components/IntegracionesPanel';
import {
  copiarAlPortapapeles,
  etiquetaLenguajeApi,
  generarSnippet,
  lenguajeApiPredeterminado,
  opcionesLenguajeApi,
  opcionesSnippet,
  type LenguajeApi,
  type SnippetCodigo,
} from '../snippets';

type FiltroActivo = 'todos' | 'activas' | 'inactivas';

const ICONO_SNIPPET: Record<SnippetCodigo, typeof Code2> = {
  frontend: Code2,
  console: SquareTerminal,
  backend: Server,
  sql: Database,
  api: Braces,
};

const NOMBRE_SNIPPET: Record<SnippetCodigo, string> = {
  frontend: 'frontend',
  console: 'consola',
  backend: 'backend',
  sql: 'SQL',
  api: 'API externa',
};

interface SnippetVisible {
  variable: VariableConfiguracion;
  tipo: SnippetCodigo;
  codigo: string;
  lenguaje?: LenguajeApi;
}

export function ConfiguracionVariablesPage() {
  usePageTitle('Configuración');
  usePermissionVersion(); // re-render cuando cambian los permisos

  const puedeCrear = tienePermiso(PERMISOS_CONFIGURACION.crear);
  const puedeActualizar = tienePermiso(PERMISOS_CONFIGURACION.actualizar);
  const puedeHistorial = tienePermiso(PERMISOS_CONFIGURACION.historial);
  const puedeRestaurar = tienePermiso(PERMISOS_CONFIGURACION.restaurar);
  const puedeApiKeys = tienePermiso(PERMISOS_CONFIGURACION.apiKeys);

  const [buscar, setBuscar] = useState('');
  const [buscarDebounced, setBuscarDebounced] = useState('');
  const [namespaceFiltro, setNamespaceFiltro] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [destino, setDestino] = useState('todos');
  const [activo, setActivo] = useState<FiltroActivo>('todos');
  const [refreshKey, setRefreshKey] = useState(0);

  const [variables, setVariables] = useState<VariableConfiguracion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editor, setEditor] = useState<{ variable: VariableConfiguracion | null } | null>(null);
  const [historialVariable, setHistorialVariable] = useState<VariableConfiguracion | null>(null);
  const [snippetVisible, setSnippetVisible] = useState<SnippetVisible | null>(null);

  const [estadoPendiente, setEstadoPendiente] = useState<VariableConfiguracion | null>(null);
  const [procesandoEstado, setProcesandoEstado] = useState<number | null>(null);
  const operacionesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const temporizador = setTimeout(() => setBuscarDebounced(buscar.trim()), 350);
    return () => clearTimeout(temporizador);
  }, [buscar]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setCargando(true);
      setError(null);
      try {
        const datos = await listarVariables(
          {
            buscar: buscarDebounced,
            tipo: tipo === 'todos' ? '' : tipoDatoBackend(tipo),
            destino: destino === 'todos' ? '' : (destino as DestinoConfig),
            activo: activo === 'todos' ? '' : activo === 'activas',
          },
          controller.signal,
        );
        setVariables(datos);
      } catch (err) {
        if (esCancelado(err)) return;
        setError(mensajeError(err, 'No se pudieron cargar las variables.'));
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    })();

    return () => controller.abort();
  }, [buscarDebounced, tipo, destino, activo, refreshKey]);

  const recargar = useCallback(() => {
    setRefreshKey((actual) => actual + 1);
  }, []);

  const hayFiltros =
    buscar.trim() !== '' ||
    namespaceFiltro !== 'todos' ||
    tipo !== 'todos' ||
    destino !== 'todos' ||
    activo !== 'todos';

  const namespaces = namespacesDeVariables(variables);
  if (namespaceFiltro !== 'todos' && !namespaces.includes(namespaceFiltro)) {
    namespaces.push(namespaceFiltro);
  }

  const variablesVisibles =
    namespaceFiltro === 'todos'
      ? variables
      : variables.filter((variable) => namespaceDeClave(variable.clave) === namespaceFiltro);

  const limpiarFiltros = () => {
    setBuscar('');
    setNamespaceFiltro('todos');
    setTipo('todos');
    setDestino('todos');
    setActivo('todos');
  };

  const abrirCrear = () => {
    if (!puedeCrear) return;
    setEditor({ variable: null });
  };

  const abrirEditar = (variable: VariableConfiguracion) => {
    if (!puedeActualizar) return;
    setEditor({ variable });
  };

  const abrirHistorial = (variable: VariableConfiguracion) => {
    if (!puedeHistorial) return;
    setHistorialVariable(variable);
  };

  const cambiarLenguajeSnippet = (lenguaje: LenguajeApi) => {
    setSnippetVisible((actual) => {
      if (!actual || actual.tipo !== 'api') return actual;
      return {
        ...actual,
        lenguaje,
        codigo: generarSnippet(actual.variable, 'api', lenguaje),
      };
    });
  };

  const copiarSnippetVisible = async () => {
    if (!snippetVisible) return;
    const copiado = await copiarAlPortapapeles(snippetVisible.codigo);
    if (copiado) {
      toast.success('Código copiado al portapapeles.');
    } else {
      toast.error('El navegador bloqueó el portapapeles.', {
        description: 'Selecciona el texto del cuadro y cópialo manualmente.',
      });
    }
  };

  const copiarCodigo = async (variable: VariableConfiguracion, tipo: SnippetCodigo) => {
    const lenguaje = tipo === 'api' ? lenguajeApiPredeterminado(variable) : undefined;
    const codigo = generarSnippet(variable, tipo, lenguaje);
    setSnippetVisible({ variable, tipo, codigo, lenguaje });
    const copiado = await copiarAlPortapapeles(codigo);

    if (copiado) {
      toast.success(`Código ${NOMBRE_SNIPPET[tipo]} copiado.`, {
        description: 'También puedes revisarlo o seleccionarlo en la ventana.',
      });
    } else {
      toast.error('El portapapeles fue bloqueado por el navegador.', {
        description: 'El código quedó visible para que lo copies manualmente.',
      });
    }
  };

  const cerrarPorConflicto = () => {
    setEditor(null);
    setHistorialVariable(null);
    recargar();
  };

  const cambiarEstado = async (variable: VariableConfiguracion) => {
    if (procesandoEstado !== null) return;

    const accion = variable.activo ? 'desactivar' : 'reactivar';
    const claveOperacion = claveOperacionEstado(accion, variable.idVariable);
    const idOperacion = operacionesRef.current[claveOperacion] ?? nuevoIdOperacion();
    operacionesRef.current[claveOperacion] = idOperacion;

    setProcesandoEstado(variable.idVariable);

    try {
      const payload = { versionEsperada: variable.version, idOperacion };
      if (variable.activo) {
        await desactivarVariable(variable.idVariable, payload);
      } else {
        await reactivarVariable(variable.idVariable, payload);
      }

      delete operacionesRef.current[claveOperacion];
      setEstadoPendiente(null);
      toast.success(
        variable.activo
          ? 'Variable desactivada.'
          : 'Variable reactivada.',
        {
          description: variable.activo
            ? 'Los consumidores dejarán de recibirla.'
            : 'Volverá a entregarse a sus destinos.',
        },
      );
      recargar();
    } catch (err) {
      if (esCancelado(err)) return;

      if (esConflicto(err)) {
        delete operacionesRef.current[claveOperacion];
        setEstadoPendiente(null);
        toast.error('Otra persona modificó esta variable.', {
          description: 'Se recargaron los datos con la versión más reciente.',
        });
        recargar();
        return;
      }

      const mensaje = mensajeError(err, 'No se pudo cambiar el estado de la variable.');
      if (esErrorReintentable(err)) {
        toast.error(mensaje, {
          description:
            'Pudo ser un timeout. Reintenta: se reutilizará el mismo identificador de operación.',
        });
      } else {
        delete operacionesRef.current[claveOperacion];
        toast.error(mensaje);
      }
    } finally {
      setProcesandoEstado(null);
    }
  };

  const accionesDisponibles = puedeActualizar || puedeHistorial;

  const contenidoVariables = (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={abrirCrear}
          disabled={!puedeCrear}
          title={puedeCrear ? undefined : 'No tienes permiso para crear variables'}
        >
          <Plus className="h-4 w-4" />
          Crear variable
        </Button>
      </div>

      <details className="group rounded-xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          <span className="inline-flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            ¿Cómo usar una variable?
            <span className="text-[11px] font-normal text-muted-foreground">
              Frontend, Backend, SQL e integraciones
            </span>
          </span>
        </summary>
        <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3">
            <p className="text-xs font-semibold text-sky-800">Frontend</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Consume el valor con el hook y se actualiza por SSE.
            </p>
            <code className="mt-2 block break-words rounded bg-white/70 p-2 font-mono text-[10px] text-sky-900">
              useConfig&lt;T&gt;('modulo.clave')
            </code>
            <code className="mt-1 block break-words rounded bg-white/70 p-2 font-mono text-[10px] text-sky-900">
              window.lefarmaConfig.get('modulo.clave')
            </code>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
            <p className="text-xs font-semibold text-violet-800">Backend</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Inyecta el servicio y obtén el valor tipado.
            </p>
            <code className="mt-2 block break-words rounded bg-white/70 p-2 font-mono text-[10px] text-violet-900">
              GetAsync&lt;T&gt;("modulo.clave", ct)
            </code>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-xs font-semibold text-emerald-800">SQL Server</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Léela desde procedimientos, jobs o vistas.
            </p>
            <code className="mt-2 block break-words rounded bg-white/70 p-2 font-mono text-[10px] text-emerald-900">
              config.fn_obtener_variable(N'modulo.clave')
            </code>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
            <p className="text-xs font-semibold text-indigo-800">Otro sistema</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Usa una API Key y el endpoint de integraciones.
            </p>
            <code className="mt-2 block break-words rounded bg-white/70 p-2 font-mono text-[10px] text-indigo-900">
              GET /api/configuracion/integraciones/…
            </code>
          </div>
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          El botón <Copy className="inline h-3 w-3" /> de cada fila copia el ejemplo exacto con
          la clave y el tipo de esa variable.
        </p>
      </details>

      <div className="rounded-lg border border-border bg-card">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar por namespace, nombre o clave…"
              className="pl-9"
              aria-label="Buscar variables"
            />
          </div>

          <Select value={namespaceFiltro} onValueChange={setNamespaceFiltro}>
            <SelectTrigger className="w-[170px]" aria-label="Filtrar por namespace">
              <SelectValue placeholder="Namespace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los namespaces</SelectItem>
              {namespaces.map((namespace) => (
                <SelectItem key={namespace} value={namespace}>
                  {namespace}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[160px]" aria-label="Filtrar por tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {TIPOS_DATO.map((opcion) => (
                <SelectItem key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={destino} onValueChange={setDestino}>
            <SelectTrigger className="w-[160px]" aria-label="Filtrar por destino">
              <SelectValue placeholder="Destino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los destinos</SelectItem>
              {DESTINOS.map((opcion) => (
                <SelectItem key={opcion.clave} value={opcion.clave}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={activo} onValueChange={(valor) => setActivo(valor as FiltroActivo)}>
            <SelectTrigger className="w-[140px]" aria-label="Filtrar por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="activas">Activas</SelectItem>
              <SelectItem value="inactivas">Inactivas</SelectItem>
            </SelectContent>
          </Select>

          {hayFiltros && (
            <Button type="button" variant="ghost" size="sm" onClick={limpiarFiltros}>
              <X className="h-4 w-4" />
              Limpiar
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={recargar}
            disabled={cargando}
            aria-label="Recargar variables"
            title="Recargar"
          >
            <RefreshCw className={cargando ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
        </div>

        {/* Contenido */}
        {cargando && variables.length === 0 ? (
          <InlineLoader message="Cargando variables…" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">
                Verifica la conexión e inténtalo de nuevo.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={recargar}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </div>
        ) : variablesVisibles.length === 0 ? (
          <EmptyState
            icon={<Settings2 className="h-10 w-10" />}
            title={hayFiltros ? 'Sin resultados' : 'Aún no hay variables'}
            description={
              hayFiltros
                ? 'Ajusta o limpia los filtros para ver más resultados.'
                : puedeCrear
                  ? 'Crea la primera variable global para que las aplicaciones la consuman.'
                  : 'Aún no hay variables globales configuradas.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1020px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Variable</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="min-w-[180px]">Valor</TableHead>
                  <TableHead>Destinos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variablesVisibles.map((variable) => {
                  const destinosActivos = DESTINOS.filter(
                    (opcion) => variable[opcion.campo],
                  );

                  return (
                    <TableRow key={variable.idVariable}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{variable.nombre}</span>
                          <code className="w-fit rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {variable.clave}
                          </code>
                          {variable.descripcion && (
                            <span className="line-clamp-1 max-w-[320px] text-[11px] text-muted-foreground">
                              {variable.descripcion}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="whitespace-nowrap font-mono text-[10px]"
                        >
                          {namespaceDeClave(variable.clave)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="whitespace-nowrap text-[11px]">
                          {etiquetaTipo(variable.tipoDato)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code
                          className="block max-w-[260px] truncate font-mono text-[11px] text-muted-foreground"
                          title={resumirValor(variable.valor, 400)}
                        >
                          {resumirValor(variable.valor)}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {destinosActivos.length > 0 ? (
                            destinosActivos.map((opcion) => (
                              <Badge
                                key={opcion.clave}
                                variant="secondary"
                                className="text-[10px] font-normal"
                              >
                                {opcion.etiqueta}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            variable.activo
                              ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                              : 'border-border text-muted-foreground'
                          }
                        >
                          {variable.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          v{variable.version}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatearFecha(variable.fechaModificacion, true)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Copiar código de uso de ${variable.nombre}`}
                                title="Copiar código de uso"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              <DropdownMenuLabel className="space-y-0.5">
                                <span className="block text-xs font-medium">
                                  Copiar código de uso
                                </span>
                                <span className="block truncate font-mono text-[10px] font-normal text-muted-foreground">
                                  {variable.clave}
                                </span>
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {opcionesSnippet(variable).map((opcion) => {
                                const Icono = ICONO_SNIPPET[opcion.tipo];
                                return (
                                  <DropdownMenuItem
                                    key={opcion.tipo}
                                    disabled={!opcion.disponible}
                                    onSelect={() => {
                                      if (opcion.disponible) {
                                        void copiarCodigo(variable, opcion.tipo);
                                      }
                                    }}
                                    title={
                                      opcion.disponible
                                        ? `Copiar ejemplo para ${opcion.etiqueta}`
                                        : `La variable no tiene activo el destino ${opcion.etiqueta}`
                                    }
                                  >
                                    <Icono className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="flex min-w-0 flex-col">
                                      <span className="text-xs font-medium">
                                        {opcion.etiqueta}
                                      </span>
                                      <span className="truncate font-mono text-[10px] font-normal text-muted-foreground">
                                        {opcion.disponible
                                          ? opcion.descripcion
                                          : 'Destino no habilitado'}
                                      </span>
                                    </span>
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {accionesDisponibles ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Acciones para ${variable.nombre}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel className="truncate text-[11px] font-normal text-muted-foreground">
                                  {variable.clave}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {puedeActualizar && (
                                  <DropdownMenuItem onSelect={() => abrirEditar(variable)}>
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                {puedeHistorial && (
                                  <DropdownMenuItem onSelect={() => abrirHistorial(variable)}>
                                    <History className="mr-2 h-3.5 w-3.5" />
                                    Historial
                                  </DropdownMenuItem>
                                )}
                                {puedeActualizar && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={() => setEstadoPendiente(variable)}
                                      className={
                                        variable.activo
                                          ? 'text-destructive focus:text-destructive'
                                          : ''
                                      }
                                    >
                                      {variable.activo ? (
                                        <PowerOff className="mr-2 h-3.5 w-3.5" />
                                      ) : (
                                        <Power className="mr-2 h-3.5 w-3.5" />
                                      )}
                                      {variable.activo ? 'Desactivar' : 'Reactivar'}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="w-8 text-center text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {variablesVisibles.length} variable{variablesVisibles.length === 1 ? '' : 's'} mostrada
        {variablesVisibles.length === 1 ? '' : 's'}
        {cargando ? ' · actualizando…' : ''}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {puedeApiKeys ? (
        <Tabs defaultValue="variables" className="space-y-4">
          <TabsList>
            <TabsTrigger value="variables" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Variables
            </TabsTrigger>
            <TabsTrigger value="integraciones" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Integraciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="variables" className="mt-0">
            {contenidoVariables}
          </TabsContent>

          <TabsContent value="integraciones" className="mt-0">
            <IntegracionesPanel puedeGestionar={puedeApiKeys} />
          </TabsContent>
        </Tabs>
      ) : (
        contenidoVariables
      )}

      {editor && (
        <VariableEditorDialog
          key={`${editor.variable?.idVariable ?? 'nueva'}-${editor.variable?.version ?? 0}`}
          variable={editor.variable}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            recargar();
          }}
          onConflicto={cerrarPorConflicto}
        />
      )}

      {historialVariable && (
        <HistoryDialog
          key={`${historialVariable.idVariable}-${historialVariable.version}`}
          variable={historialVariable}
          puedeRestaurar={puedeRestaurar}
          onClose={() => setHistorialVariable(null)}
          onRestored={() => {
            setHistorialVariable(null);
            recargar();
          }}
          onConflicto={cerrarPorConflicto}
        />
      )}

      <AlertDialog
        open={estadoPendiente !== null}
        onOpenChange={(abierto) => {
          if (!abierto && procesandoEstado === null) setEstadoPendiente(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {estadoPendiente?.activo ? '¿Desactivar' : '¿Reactivar'} la variable «
              {estadoPendiente?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {estadoPendiente?.activo
                ? 'Dejará de entregarse a todos sus destinos. El historial y la configuración se conservan, y puedes reactivarla después.'
                : 'Volverá a entregarse a los destinos configurados con su valor actual.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesandoEstado !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={procesandoEstado !== null}
              onClick={(event) => {
                event.preventDefault();
                if (estadoPendiente) void cambiarEstado(estadoPendiente);
              }}
              className={
                estadoPendiente?.activo
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {procesandoEstado !== null && (
                <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
              )}
              {procesandoEstado !== null
                ? 'Aplicando…'
                : estadoPendiente?.activo
                  ? 'Desactivar'
                  : 'Reactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal
        id="modal-codigo-configuracion"
        open={snippetVisible !== null}
        setOpen={(abierto) => {
          if (!abierto) setSnippetVisible(null);
        }}
        title="Código de uso"
        subtitle={
          snippetVisible
            ? `${NOMBRE_SNIPPET[snippetVisible.tipo]}${
                snippetVisible.lenguaje
                  ? ` · ${etiquetaLenguajeApi(snippetVisible.lenguaje)}`
                  : ''
              } · ${snippetVisible.variable.clave}`
            : undefined
        }
        size="wide"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              El código queda seleccionado al entrar al cuadro.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setSnippetVisible(null)}>
                Cerrar
              </Button>
              <Button type="button" onClick={() => void copiarSnippetVisible()}>
                <Copy className="h-4 w-4" />
                Copiar código
              </Button>
            </div>
          </div>
        }
      >
        {snippetVisible && (
          <div className="space-y-3">
            {snippetVisible.tipo === 'api' && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor="snippet-lenguaje"
                    className="text-xs font-medium text-foreground"
                  >
                    Lenguaje
                  </label>
                  <Select
                    value={snippetVisible.lenguaje ?? 'curl'}
                    onValueChange={(valor) => cambiarLenguajeSnippet(valor as LenguajeApi)}
                  >
                    <SelectTrigger
                      id="snippet-lenguaje"
                      className="w-[280px]"
                      aria-label="Lenguaje del ejemplo de consumo"
                    >
                      <SelectValue placeholder="Selecciona un lenguaje" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcionesLenguajeApi(snippetVisible.variable)
                        .filter((opcion) => opcion.disponible)
                        .map((opcion) => (
                          <SelectItem key={opcion.valor} value={opcion.valor}>
                            {opcion.etiqueta}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="pb-2 text-[11px] text-muted-foreground">
                  T-SQL usa la función local; los demás lenguajes consumen la API con API Key.
                </p>
              </div>
            )}
            <Textarea
              readOnly
              autoFocus
              value={snippetVisible.codigo}
              rows={12}
              spellCheck={false}
              aria-label="Código de uso de la variable"
              className="min-h-[260px] resize-y bg-slate-950 font-mono text-xs leading-relaxed text-slate-100"
              onFocus={(event) => event.currentTarget.select()}
            />
            <p className="text-[11px] text-muted-foreground">
              Si el navegador bloquea el portapapeles, el texto ya está seleccionado: usa Ctrl+C.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
