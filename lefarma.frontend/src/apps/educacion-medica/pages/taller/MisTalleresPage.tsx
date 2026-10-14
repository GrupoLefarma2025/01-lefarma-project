import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ActionMenuItem } from '@/apps/educacion-medica/components/ActionMenuItem';
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileImage,
  FileSignature,
  History,
  Lock,
  MoreHorizontal,
  Package,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  ActualizarTallerRequest,
  Asignacion,
  CrearTallerRequest,
  MatrizDocumento,
  MisTalleresResponse,
  Taller,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { TallerFormModal } from './components/TallerFormModal';
import { TallerDetalleModal } from './components/TallerDetalleModal';
import { MatrizPrintDocument } from './components/MatrizPrintDocument';
import { TallerMaterialModal } from './components/TallerMaterialModal';
import { TallerAsistenciaModal } from './components/TallerAsistenciaModal';
import { TallerEvidenciasModal } from './components/TallerEvidenciasModal';
import { TallerEstadoModal } from './components/TallerEstadoModal';
import { TallerHistorialEstadosModal } from './components/TallerHistorialEstadosModal';
import { TallerAjustesModal } from './components/TallerAjustesModal';
import { SolicitarCambioModal } from './components/SolicitarCambioModal';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtFecha = (fecha: string | null) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

/** Badge del estado de impartición del taller con icono (decisión #14; ADR-00008). */
function EstadoTallerBadge({ estado }: { estado: string }) {
  if (estado === 'Programado') {
    return (
      <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300">
        <CalendarClock className="h-3 w-3" />
        Programado
      </Badge>
    );
  }
  if (estado === 'EnCurso') {
    return (
      <Badge className="gap-1 bg-blue-600 text-white">
        <PlayCircle className="h-3 w-3" />
        En curso
      </Badge>
    );
  }
  if (estado === 'Realizado') {
    return (
      <Badge className="gap-1 bg-emerald-600 text-white">
        <CheckCircle2 className="h-3 w-3" />
        Realizado
      </Badge>
    );
  }
  if (estado === 'Cancelado') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Cancelado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <CalendarClock className="h-3 w-3" />
      {estado}
    </Badge>
  );
}

export default function MisTalleresPage() {
  usePageTitle('Mis talleres', 'Educación Médica');

  const [searchParams, setSearchParams] = useSearchParams();

  const hoy = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(() => hoy.getMonth() + 1);
  const [anio, setAnio] = useState(() => hoy.getFullYear());
  const aniosDisponibles = useMemo(
    () => [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1],
    [hoy]
  );
  const periodo = useMemo(() => `${anio}-${String(mes).padStart(2, '0')}`, [anio, mes]);

  // Permisos de impartición (ADR-00008/00010; espejo de Permissions.EducacionMedica)
  const puedeGestionarMaterial = usePermission({
    require: 'educacion_medica.materiales.puede_gestionar',
  });
  const puedeConfirmarMaterial = usePermission({
    require: 'educacion_medica.materiales.puede_confirmar',
  });
  const puedeCapturarAsistencia = usePermission({
    require: 'educacion_medica.talleres.puede_capturar',
  });
  const puedeGestionarEvidencias = usePermission({
    require: 'educacion_medica.evidencias.puede_gestionar',
  });
  const puedeAjustarTalleres = usePermission({
    require: 'educacion_medica.talleres.puede_ajustar',
  });

  const [data, setData] = useState<MisTalleresResponse | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  // Deep-link "Registrar taller" desde Mis hospitales del mes: el modal abre con el hospital precargado.
  const [modalOpen, setModalOpen] = useState(() => searchParams.get('nuevo') === '1');
  const [editando, setEditando] = useState<Taller | null>(null);
  const [detalle, setDetalle] = useState<Taller | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [confirmarGenerar, setConfirmarGenerar] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  // Modales de impartición (ADR-00008) y solicitudes (ADR-00010)
  const [materialTaller, setMaterialTaller] = useState<Taller | null>(null);
  const [asistenciaTaller, setAsistenciaTaller] = useState<Taller | null>(null);
  const [evidenciasTaller, setEvidenciasTaller] = useState<Taller | null>(null);
  const [estadoTaller, setEstadoTaller] = useState<Taller | null>(null);
  const [historialTaller, setHistorialTaller] = useState<Taller | null>(null);
  const [ajustesTaller, setAjustesTaller] = useState<Taller | null>(null);
  const [solicitudTaller, setSolicitudTaller] = useState<Taller | null>(null);

  const idSeleccionHospitalPrecarga = useMemo(() => {
    const valor = searchParams.get('idSeleccionHospital');
    return valor ? Number(valor) : null;
  }, [searchParams]);

  const fetchMisTalleres = useCallback(async () => {
    try {
      const response = await educacionMedicaApi.talleres.misTalleres(periodo);
      if (response.data.success) {
        setData(response.data.data ?? null);
      } else {
        toast.error(response.data.message ?? 'Error al cargar tus talleres');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar tus talleres');
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  const recargar = useCallback(() => {
    setLoading(true);
    void fetchMisTalleres();
  }, [fetchMisTalleres]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; los setState ocurren tras el await
    void fetchMisTalleres();
  }, [fetchMisTalleres]);

  useEffect(() => {
    let cancelado = false;
    educacionMedicaApi.rutas
      .asignaciones()
      .then((res) => {
        if (!cancelado && res.data.success) setAsignaciones(res.data.data ?? []);
      })
      .catch(() => setAsignaciones([]));
    return () => {
      cancelado = true;
    };
  }, []);

  const matriz = data?.matriz ?? null;
  const editable = !matriz || !matriz.esBloqueado;
  const sinEquipo = data !== null && data.idEquipo === null;

  // Panel de situación del equipo (decisión #14): KPIs del mes + avance Realizados/Total.
  const kpis = useMemo(() => {
    const talleres = data?.talleres ?? [];
    const contar = (estado: string) => talleres.filter((t) => t.estado === estado).length;
    return {
      total: talleres.length,
      programados: contar('Programado'),
      enCurso: contar('EnCurso'),
      realizados: contar('Realizado'),
      cancelados: contar('Cancelado'),
    };
  }, [data]);

  const avance = kpis.total > 0 ? Math.round((kpis.realizados / kpis.total) * 100) : 0;

  const documentoIndividual = useMemo<MatrizDocumento | null>(() => {
    if (!data || data.talleres.length === 0) return null;
    const titulo = `Matriz individual de talleres ${periodo
      .slice(0, 7)
      .split('-')
      .reverse()
      .join('/')}${data.nombreRegion ? ` – ${data.nombreRegion}` : ''}`;
    return {
      titulo,
      gerencia: null,
      periodo: data.periodo,
      pasoNombre: null,
      estadoNombre: matriz ? (matriz.esBloqueado ? 'Captura bloqueada' : 'Captura abierta') : null,
      talleres: data.talleres,
      costoTotal: data.talleres.reduce((acc, t) => acc + t.costoTotal, 0),
      firmas: [],
    };
  }, [data, periodo, matriz]);

  const abrirNuevo = () => {
    setEditando(null);
    setModalOpen(true);
  };

  const abrirEditar = useCallback((taller: Taller) => {
    setEditando(taller);
    setModalOpen(true);
  }, []);

  const abrirDetalle = useCallback((taller: Taller) => {
    setDetalle(taller);
    setDetalleOpen(true);
  }, []);

  const guardar = async (
    payload: CrearTallerRequest | ActualizarTallerRequest,
    idTaller: number | null
  ) => {
    setGuardando(true);
    try {
      const response = idTaller
        ? await educacionMedicaApi.talleres.actualizar(
            idTaller,
            payload as ActualizarTallerRequest
          )
        : await educacionMedicaApi.talleres.crear(payload as CrearTallerRequest);
      if (response.data.success) {
        toast.success(response.data.message ?? 'Taller guardado.');
        setModalOpen(false);
        setEditando(null);
        recargar();
      } else {
        toast.error(response.data.message ?? 'No se pudo guardar el taller');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo guardar el taller');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = useCallback(
    async (taller: Taller) => {
      if (!window.confirm(`¿Eliminar el taller de ${taller.nombreHospital ?? 'este hospital'}?`)) {
        return;
      }
      setProcesando(true);
      try {
        const response = await educacionMedicaApi.talleres.eliminar(taller.idTaller);
        if (response.data.success) {
          toast.success('Taller eliminado.');
          recargar();
        } else {
          toast.error(response.data.message ?? 'No se pudo eliminar el taller');
        }
      } catch (error: unknown) {
        toast.error(toApiError(error).message ?? 'No se pudo eliminar el taller');
      } finally {
        setProcesando(false);
      }
    },
    [recargar]
  );

  const generar = async () => {
    if (!matriz) return;
    setProcesando(true);
    try {
      const response = await educacionMedicaApi.talleres.generarMatrizIndividual(
        matriz.idMatrizIndividual
      );
      if (response.data.success) {
        toast.success('Matriz individual generada: la captura queda bloqueada.');
        recargar();
      } else {
        toast.error(response.data.message ?? 'No se pudo generar la matriz');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo generar la matriz');
    } finally {
      setProcesando(false);
    }
  };

  // "Solicitar cambio" (ADR-00010): candado puesto o matriz fuera de captura,
  // taller Autorizado/Programado y sin solicitud pendiente.
  const candadoPuesto =
    (matriz?.esBloqueado ?? false) ||
    (data?.estadoMatrizGeneral != null && data.estadoMatrizGeneral !== 'Creada');

  const puedeSolicitarCambio = useCallback(
    (taller: Taller) =>
      candadoPuesto &&
      (taller.estado === 'Autorizado' || taller.estado === 'Programado') &&
      !taller.solicitudCambioPendiente,
    [candadoPuesto]
  );

  const puedeAjustarDirecto = useCallback(
    (taller: Taller) =>
      puedeAjustarTalleres &&
      (taller.estado === 'Autorizado' || taller.estado === 'Programado'),
    [puedeAjustarTalleres]
  );

  const columnas = useMemo<ColumnDef<Taller>[]>(
    () => [
      {
        id: 'hospital',
        accessorFn: (taller) =>
          [taller.nombreHospital, taller.unidadMedica].filter(Boolean).join(' '),
        header: 'Hospital',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate">{row.original.nombreHospital ?? '—'}</span>
              {row.original.esExtraordinario && (
                <Badge
                  variant="outline"
                  className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-300"
                  title={row.original.motivoExtraordinario ?? 'Taller extraordinario'}
                >
                  Extraordinario
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.unidadMedica ?? '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'solicitud',
        header: 'Solicitud de cambio',
        cell: ({ row }) =>
          row.original.solicitudCambioPendiente ? (
            <Badge
              variant="outline"
              className="gap-1 border-purple-300 text-[10px] text-purple-700 dark:border-purple-800 dark:text-purple-300"
              title={`Solicitud pendiente de ${row.original.solicitudCambioPendiente.nombreSolicitante ?? 'el equipo'}`}
            >
              <FileSignature className="h-3 w-3" />
              Pendiente
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'estadoMatriz',
        header: 'Estado de la matriz',
        cell: () => {
          const color = data?.estadoMatrizGeneralColor ?? '#94a3b8';
          return (
            <span
              className="inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              style={{
                borderColor: color,
                color,
                backgroundColor: color + '15',
              }}
              title={
                data?.pasoActualMatrizGeneral
                  ? `Paso actual: ${data.pasoActualMatrizGeneral}`
                  : undefined
              }
            >
              {data?.estadoMatrizGeneral ?? '—'}
            </span>
          );
        },
      },
      {
        id: 'estadoTaller',
        header: 'Estado del taller',
        cell: ({ row }) => <EstadoTallerBadge estado={row.original.estado} />,
      },
      {
        id: 'fechaHora',
        accessorFn: (taller) =>
          [taller.fechaTaller, taller.horaTaller].filter(Boolean).join(' '),
        header: 'Fecha y hora del taller',
        cell: ({ row }) => (
          <div className="text-sm">
            <p>{fmtFecha(row.original.fechaTaller)}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.horaTaller?.slice(0, 5) ?? '—'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'numeroParticipantes',
        header: 'Participantes',
        cell: ({ row }) => row.original.numeroParticipantes ?? '—',
      },
      /* {
        id: 'recursos',
        header: 'Recursos',
        cell: ({ row }) => row.original.recursos.length,
      }, */
      {
        accessorKey: 'costoTotal',
        header: 'Costo total',
        cell: ({ row }) => fmtMoneda(row.original.costoTotal),
      },
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => {
          const taller = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => abrirDetalle(taller)}
                title="Ver detalle"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={(!editable && !puedeAjustarDirecto(taller)) || procesando}
                onClick={() => abrirEditar(taller)}
                title={puedeAjustarDirecto(taller) ? 'Ajustar taller (post-cierre)' : 'Editar'}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    aria-label="Más acciones"
                    title="Más acciones"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <ActionMenuItem
                    label="Material"
                    icon={Package}
                    onClick={() => setMaterialTaller(taller)}
                  />
                  <ActionMenuItem
                    label="Asistencia"
                    icon={ClipboardList}
                    onClick={() => setAsistenciaTaller(taller)}
                  />
                  <ActionMenuItem
                    label="Evidencias"
                    icon={FileImage}
                    onClick={() => setEvidenciasTaller(taller)}
                  />
                  <DropdownMenuSeparator />
                  <ActionMenuItem
                    label="Cambiar estado"
                    icon={PlayCircle}
                    onClick={() => setEstadoTaller(taller)}
                  />
                  <ActionMenuItem
                    label="Historial de estados"
                    icon={History}
                    onClick={() => setHistorialTaller(taller)}
                  />
                  <ActionMenuItem
                    label="Historial de ajustes"
                    icon={Wrench}
                    onClick={() => setAjustesTaller(taller)}
                  />
                  {puedeSolicitarCambio(taller) && (
                    <ActionMenuItem
                      label="Solicitar cambio"
                      icon={CalendarPlus}
                      onClick={() => setSolicitudTaller(taller)}
                    />
                  )}
                  <DropdownMenuSeparator />
                  <ActionMenuItem
                    label="Eliminar"
                    icon={Trash2}
                    destructive
                    disabled={!editable || procesando}
                    onClick={() => void eliminar(taller)}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      editable,
      procesando,
      abrirEditar,
      abrirDetalle,
      eliminar,
      puedeSolicitarCambio,
      puedeAjustarDirecto,
      data,
    ]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mes</label>
            <Select
              value={String(mes)}
              onValueChange={(valor) => {
                setLoading(true);
                setMes(Number(valor));
              }}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((nombre, idx) => (
                  <SelectItem key={nombre} value={String(idx + 1)}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Año</label>
            <Select
              value={String(anio)}
              onValueChange={(valor) => {
                setLoading(true);
                setAnio(Number(valor));
              }}
            >
              <SelectTrigger className="h-9 w-24">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {aniosDisponibles.map((valor) => (
                  <SelectItem key={valor} value={String(valor)}>
                    {valor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrintOpen(true)}
            disabled={!documentoIndividual}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-sky-200 bg-sky-50/60 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/20">
          <p className="text-xs text-muted-foreground">Equipo de pareo</p>
          <p className="text-sm font-semibold">
            {sinEquipo
              ? 'Sin equipo de pareo activo'
              : data?.nombreEjecutivo || data?.nombreEspecialista
                ? `${data.nombreEjecutivo ?? 'EV'} + ${data.nombreEspecialista ?? 'EP'}`
                : data?.idEquipo
                  ? `Equipo ${data.idEquipo}`
                  : '—'}
          </p>
          <p className="text-xs text-muted-foreground">{data?.nombreRegion ?? ''}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Matriz individual del mes</p>
            {matriz && (
              <Badge variant={matriz.esBloqueado ? 'default' : 'outline'}>
                {matriz.esBloqueado ? 'Captura bloqueada' : 'Captura abierta'}
              </Badge>
            )}
          </div>
          {matriz ? (
            <>
              <p className="text-sm font-semibold">
                {matriz.totalTalleres} taller(es) capturados
              </p>
              <p className="text-xs text-muted-foreground">
                {matriz.esBloqueado
                  ? `Captura bloqueada${
                      matriz.fechaBloqueo
                        ? ` el ${new Date(matriz.fechaBloqueo).toLocaleDateString('es-MX')}`
                        : ''
                    }. El Gerente de Ventas puede reabrirla desde la Matriz de talleres mientras la general siga en Creada.`
                  : matriz.fechaDesbloqueo
                    ? `Captura abierta (reabierta el ${new Date(
                        matriz.fechaDesbloqueo
                      ).toLocaleDateString('es-MX')}): agrega o edita los talleres del mes. Al generar la matriz, la captura se bloquea.`
                    : 'Captura abierta: agrega o edita los talleres del mes. Al generar la matriz, la captura se bloquea.'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Aún sin capturas</p>
              <p className="text-xs text-muted-foreground">
                Captura el primer taller del mes para crear la matriz individual del equipo.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Panel de situación del equipo (decisión #14): KPIs + avance del mes */}
      {!sinEquipo && kpis.total > 0 && (
        <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 shadow-sm dark:border-violet-900 dark:bg-violet-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Situación del mes</p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-semibold tabular-nums">{kpis.programados}</span>
                <span className="text-muted-foreground">Programados</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-semibold tabular-nums">{kpis.enCurso}</span>
                <span className="text-muted-foreground">En curso</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold tabular-nums">{kpis.realizados}</span>
                <span className="text-muted-foreground">Realizados</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="font-semibold tabular-nums">{kpis.cancelados}</span>
                <span className="text-muted-foreground">Cancelados</span>
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Avance: {kpis.realizados}/{kpis.total} talleres realizados
              </span>
              <span className="font-semibold tabular-nums">{avance}%</span>
            </div>
            <Progress value={avance} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={abrirNuevo} disabled={!editable || sinEquipo || procesando}>
          <Plus className="mr-1 h-4 w-4" />
          Nuevo taller
        </Button>
        {matriz && !matriz.esBloqueado && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmarGenerar(true)}
            disabled={procesando}
          >
            <Lock className="mr-1 h-4 w-4" />
            Generar matriz
          </Button>
        )}
      </div>

      {sinEquipo ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No participas en un equipo de pareo activo; pide al administrador que te asigne uno para
          capturar talleres.
        </p>
      ) : (
        <DataTable
          columns={columnas}
          data={data?.talleres ?? []}
          title="Talleres capturados"
          subtitle="Talleres capturados por el equipo en el mes. Material, asistencia, evidencias y estados se gestionan por fila."
          showRowCount
          loading={loading}
          globalFilter
          showRefreshButton
          onRefresh={recargar}
          pagination
          pageSize={20}
          filterConfig={{
            tableId: 'educacion-medica-mis-talleres',
            searchableColumns: [
              'hospital',
              'fechaHora',
              'numeroParticipantes',
            ],
            defaultSearchColumns: ['hospital'],
          }}
        />
      )}

      <TallerFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditando(null);
          if (searchParams.toString()) setSearchParams({}, { replace: true });
        }}
        taller={editando}
        asignaciones={asignaciones}
        idSeleccionHospitalInicial={idSeleccionHospitalPrecarga}
        nombreEjecutivo={data?.nombreEjecutivo ?? null}
        nombreEspecialista={data?.nombreEspecialista ?? null}
        guardando={guardando}
        onGuardar={guardar}
      />

      <TallerDetalleModal
        open={detalleOpen}
        onClose={() => {
          setDetalleOpen(false);
          setDetalle(null);
        }}
        taller={detalle}
        ubicacion={
          detalle
            ? (asignaciones.find((a) => a.idSeleccionHospital === detalle.idSeleccionHospital) ??
              null)
            : null
        }
        acciones={
          detalle ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMaterialTaller(detalle)}
              >
                <Package className="mr-1.5 h-4 w-4" />
                Material
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAsistenciaTaller(detalle)}
              >
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Asistencia
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEvidenciasTaller(detalle)}
              >
                <FileImage className="mr-1.5 h-4 w-4" />
                Evidencias
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEstadoTaller(detalle)}
              >
                <PlayCircle className="mr-1.5 h-4 w-4" />
                Cambiar estado
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHistorialTaller(detalle)}
              >
                <History className="mr-1.5 h-4 w-4" />
                Historial
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAjustesTaller(detalle)}
              >
                <Wrench className="mr-1.5 h-4 w-4" />
                Ajustes
              </Button>
              {puedeSolicitarCambio(detalle) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300"
                  onClick={() => setSolicitudTaller(detalle)}
                >
                  <CalendarPlus className="mr-1.5 h-4 w-4" />
                  Solicitar cambio
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <TallerMaterialModal
        open={materialTaller !== null}
        onClose={() => setMaterialTaller(null)}
        taller={materialTaller}
        puedeGestionar={puedeGestionarMaterial}
        puedeConfirmar={puedeConfirmarMaterial}
        onChanged={recargar}
      />

      <TallerAsistenciaModal
        open={asistenciaTaller !== null}
        onClose={() => setAsistenciaTaller(null)}
        taller={asistenciaTaller}
        puedeCapturar={puedeCapturarAsistencia}
        onChanged={recargar}
      />

      <TallerEvidenciasModal
        open={evidenciasTaller !== null}
        onClose={() => setEvidenciasTaller(null)}
        taller={evidenciasTaller}
        puedeGestionar={puedeGestionarEvidencias}
        onChanged={recargar}
      />

      <TallerEstadoModal
        open={estadoTaller !== null}
        onClose={() => setEstadoTaller(null)}
        taller={estadoTaller}
        onChanged={recargar}
      />

      <TallerHistorialEstadosModal
        open={historialTaller !== null}
        onClose={() => setHistorialTaller(null)}
        taller={historialTaller}
      />

      <TallerAjustesModal
        open={ajustesTaller !== null}
        onClose={() => setAjustesTaller(null)}
        taller={ajustesTaller}
      />

      <SolicitarCambioModal
        open={solicitudTaller !== null}
        onClose={() => setSolicitudTaller(null)}
        taller={solicitudTaller}
        onCreated={recargar}
      />

      <AlertDialog open={confirmarGenerar} onOpenChange={setConfirmarGenerar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generar matriz individual</AlertDialogTitle>
            <AlertDialogDescription>
              Al generar la matriz se bloquea la captura del equipo: ya no podrás agregar ni editar
              talleres de este mes. El Gerente de Ventas puede reabrirla mientras la matriz general
              siga en Creada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={procesando}
              onClick={(evento) => {
                evento.preventDefault();
                void generar().finally(() => setConfirmarGenerar(false));
              }}
            >
              {procesando ? 'Generando...' : 'Generar matriz'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MatrizPrintDocument
        open={printOpen}
        onOpenChange={setPrintOpen}
        documento={documentoIndividual}
      />
    </div>
  );
}
