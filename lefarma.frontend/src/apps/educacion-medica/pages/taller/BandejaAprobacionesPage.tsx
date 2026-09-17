import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Eye, Loader2, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/shared/auth/authStore';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import type { WorkflowEstado } from '@/types/workflow.types';
import { SignatureAlert } from '@/components/common/SignatureAlert';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  PendienteAprobacion,
  Ruta,
  RutaVersionDto,
  SeleccionDetalle,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import type { AccionWorkflow } from '@/components/workflows/workflowAccion';
import { BandejaTable } from '@/apps/educacion-medica/components/BandejaTable';
import { DocumentoFirmaModal } from '@/apps/educacion-medica/components/DocumentoFirmaModal';
import { DocumentoHistorialModal } from '@/apps/educacion-medica/components/DocumentoHistorialModal';
import { DocumentoArchivosModal } from '@/apps/educacion-medica/components/DocumentoArchivosModal';

const PERMISO_VER_TODOS = 'educacion_medica.aprobaciones.puede_ver_todos';

const formatearFecha = (fecha?: string | null) => {
  if (!fecha) return '—';
  try {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
};

interface FiltrosBandeja {
  busqueda: string;
  tipo: 'todos' | 'seleccion' | 'rutas';
  idEstado: string; // 'all' | idEstado
  etapa: string; // 'all' | pasoNombre
  fechaDesde: string;
  fechaHasta: string;
}

const FILTROS_INICIALES: FiltrosBandeja = {
  busqueda: '',
  tipo: 'todos',
  idEstado: 'all',
  etapa: 'all',
  fechaDesde: '',
  fechaHasta: '',
};

export default function BandejaAprobacionesPage() {
  usePageTitle('Bandeja de Autorizaciones', 'Educación Médica');
  const navigate = useNavigate();
  const { hasFirma } = useAuthStore();
  const puedeVerTodos = usePermission({ require: PERMISO_VER_TODOS });

  const [tab, setTab] = useState<'pendientes' | 'todos'>('pendientes');
  const [dataPendientes, setDataPendientes] = useState<PendienteAprobacion[]>([]);
  const [dataTodos, setDataTodos] = useState<PendienteAprobacion[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState(true);
  const [loadingTodos, setLoadingTodos] = useState(false);
  const [draftFiltersByTab, setDraftFiltersByTab] = useState<
    Record<'pendientes' | 'todos', FiltrosBandeja>
  >({ pendientes: FILTROS_INICIALES, todos: FILTROS_INICIALES });
  const [appliedFiltersByTab, setAppliedFiltersByTab] = useState<
    Record<'pendientes' | 'todos', FiltrosBandeja>
  >({ pendientes: FILTROS_INICIALES, todos: FILTROS_INICIALES });
  const [workflowEstados, setWorkflowEstados] = useState<WorkflowEstado[]>([]);

  // Documento seleccionado + modales independientes (patrón RH)
  const [seleccionado, setSeleccionado] = useState<PendienteAprobacion | null>(null);
  const [modalStates, setModalStates] = useState({
    detalle: false,
    firma: false,
    archivos: false,
    historial: false,
  });
  const [guardando, setGuardando] = useState(false);

  // Detalle
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [seleccionDetalle, setSeleccionDetalle] = useState<SeleccionDetalle | null>(null);
  const [versionInfo, setVersionInfo] = useState<RutaVersionDto | null>(null);
  const [rutasVersion, setRutasVersion] = useState<Ruta[]>([]);
  const [totalHospitalesSeleccion, setTotalHospitalesSeleccion] = useState<number | null>(null);

  const draftFilters = draftFiltersByTab[tab];
  const appliedFilters = appliedFiltersByTab[tab];
  const loadingCurrentTab = tab === 'pendientes' ? loadingPendientes : loadingTodos;
  const documentosTab = tab === 'pendientes' ? dataPendientes : dataTodos;

  const fetchTab = useCallback(async (targetTab: 'pendientes' | 'todos') => {
    const setLoading = targetTab === 'pendientes' ? setLoadingPendientes : setLoadingTodos;
    const setData = targetTab === 'pendientes' ? setDataPendientes : setDataTodos;
    setLoading(true);
    try {
      const res = await educacionMedicaApi.aprobaciones.getDocumentos(targetTab);
      if (res.data.success) {
        setData(res.data.data ?? []);
      } else {
        toast.error(res.data.message ?? 'No se pudieron cargar los documentos');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudieron cargar los documentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;

    educacionMedicaApi.aprobaciones
      .getDocumentos('pendientes')
      .then((res) => {
        if (!cancelado && res.data.success) setDataPendientes(res.data.data ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelado) {
          toast.error(toApiError(error).message ?? 'No se pudieron cargar los pendientes');
        }
      })
      .finally(() => {
        if (!cancelado) setLoadingPendientes(false);
      });

    if (puedeVerTodos) {
      educacionMedicaApi.aprobaciones
        .getDocumentos('todos')
        .then((res) => {
          if (!cancelado && res.data.success) setDataTodos(res.data.data ?? []);
        })
        .catch((error: unknown) => {
          if (!cancelado) {
            toast.error(toApiError(error).message ?? 'No se pudieron cargar los documentos');
          }
        });
    }

    return () => {
      cancelado = true;
    };
  }, [puedeVerTodos]);

  useEffect(() => {
    API.get<ApiResponse<WorkflowEstado[]>>('/config/workflows/estados')
      .then((res) => {
        if (res.data.success) setWorkflowEstados(res.data.data || []);
      })
      .catch(() => setWorkflowEstados([]));
  }, []);

  const documentosFiltrados = useMemo(() => {
    return documentosTab.filter((d) => {
      if (appliedFilters.tipo !== 'todos' && d.tipo !== appliedFilters.tipo) return false;
      if (appliedFilters.idEstado !== 'all' && d.idEstado !== Number(appliedFilters.idEstado))
        return false;
      if (appliedFilters.etapa !== 'all' && d.pasoNombre !== appliedFilters.etapa) return false;
      if (appliedFilters.busqueda.trim()) {
        const term = appliedFilters.busqueda.trim().toLowerCase();
        const texto = `${d.documento} ${d.detalle ?? ''}`.toLowerCase();
        if (!texto.includes(term)) return false;
      }
      const fecha = d.fecha?.slice(0, 10);
      if (appliedFilters.fechaDesde && (!fecha || fecha < appliedFilters.fechaDesde)) return false;
      if (appliedFilters.fechaHasta && (!fecha || fecha > appliedFilters.fechaHasta)) return false;
      return true;
    });
  }, [documentosTab, appliedFilters]);

  const etapasDisponibles = useMemo(
    () =>
      [
        ...new Set(documentosTab.map((d) => d.pasoNombre).filter((p): p is string => Boolean(p))),
      ].sort(),
    [documentosTab]
  );

  const updateDraft = <K extends keyof FiltrosBandeja>(key: K, value: FiltrosBandeja[K]) => {
    setDraftFiltersByTab((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: value } }));
  };

  const handleBuscar = () => setAppliedFiltersByTab((prev) => ({ ...prev, [tab]: draftFilters }));

  const handleLimpiar = () => {
    setDraftFiltersByTab((prev) => ({ ...prev, [tab]: FILTROS_INICIALES }));
    setAppliedFiltersByTab((prev) => ({ ...prev, [tab]: FILTROS_INICIALES }));
  };

  const toggleModal = (name: keyof typeof modalStates, state: boolean) =>
    setModalStates((prev) => ({ ...prev, [name]: state }));

  // ── Detalle ────────────────────────────────────────────────────────────────
  const handleOpenDetalle = async (item: PendienteAprobacion) => {
    setSeleccionado(item);
    toggleModal('detalle', true);
    setCargandoDetalle(true);
    setSeleccionDetalle(null);
    setVersionInfo(null);
    setRutasVersion([]);
    setTotalHospitalesSeleccion(null);

    try {
      if (item.tipo === 'seleccion') {
        const detRes = await educacionMedicaApi.seleccionesMensuales.getById(item.idEntidad);
        if (detRes.data.success) setSeleccionDetalle(detRes.data.data ?? null);
      } else {
        const verRes = await educacionMedicaApi.rutas.version(
          item.idSeleccionMensual,
          item.versionRutas ?? undefined
        );
        const info = verRes.data.success ? (verRes.data.data ?? null) : null;
        setVersionInfo(info);

        const [rutasRes, selRes] = await Promise.all([
          info
            ? educacionMedicaApi.rutas.getBySeleccion(item.idSeleccionMensual, info.version)
            : Promise.resolve(null),
          educacionMedicaApi.seleccionesMensuales.getById(item.idSeleccionMensual),
        ]);
        if (rutasRes?.data.success) setRutasVersion(rutasRes.data.data ?? []);
        if (selRes.data.success) {
          setTotalHospitalesSeleccion(selRes.data.data?.hospitales.length ?? null);
        }
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar el detalle');
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ── Firma ──────────────────────────────────────────────────────────────────
  const handleOpenFirma = (item: PendienteAprobacion) => {
    if (hasFirma === false) {
      toast.warning('No has cargado tu firma digital', {
        description: 'Ve a Configuración > Perfil para subir tu firma y poder firmar documentos.',
        duration: 6000,
      });
      return;
    }
    setSeleccionado(item);
    toggleModal('firma', true);
  };

  const confirmarAccion = async (
    accion: AccionWorkflow,
    comentario?: string,
    datosAdicionales?: Record<string, unknown> | null
  ) => {
    if (!seleccionado) return;
    setGuardando(true);
    try {
      const payload = {
        idAccion: accion.idAccion,
        comentario: comentario ?? null,
        datosAdicionales: datosAdicionales ?? null,
      };
      const res =
        seleccionado.tipo === 'seleccion'
          ? await educacionMedicaApi.seleccionesMensuales.firmar(seleccionado.idEntidad, payload)
          : await educacionMedicaApi.rutas.firmarVersion(seleccionado.idEntidad, payload);

      if (res.data.success) {
        toast.success(res.data.message ?? 'Acción registrada.');
        toggleModal('firma', false);
        setSeleccionado(null);
        await fetchTab('pendientes');
        if (puedeVerTodos) await fetchTab('todos');
      } else {
        toast.error(res.data.message ?? 'No se pudo aplicar la acción');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo aplicar la acción');
    } finally {
      setGuardando(false);
    }
  };

  // ── Archivos / Historial ───────────────────────────────────────────────────
  const handleOpenArchivos = (item: PendienteAprobacion) => {
    setSeleccionado(item);
    toggleModal('archivos', true);
  };

  const handleOpenHistorial = (item: PendienteAprobacion) => {
    setSeleccionado(item);
    toggleModal('historial', true);
  };

  const abrirDocumento = (item: PendienteAprobacion) => {
    if (item.tipo === 'rutas') {
      navigate(`/educacion-medica/seleccion/${item.idSeleccionMensual}/rutas`);
      return;
    }
    navigate(`/educacion-medica/seleccion?idSeleccion=${item.idEntidad}`);
  };

  const equiposVersion = useMemo(
    () => new Set(rutasVersion.map((r) => r.idEquipo)).size,
    [rutasVersion]
  );
  const hospitalesPlanificados = useMemo(() => {
    const ids = new Set<number>();
    rutasVersion.forEach((r) => r.visitas.forEach((v) => ids.add(v.idSeleccionHospital)));
    return ids.size;
  }, [rutasVersion]);

  const accionesBoton = {
    onDetalle: (d: PendienteAprobacion) => void handleOpenDetalle(d),
    onFirma: handleOpenFirma,
    onArchivos: handleOpenArchivos,
    onHistorial: handleOpenHistorial,
    onAbrirDocumento: abrirDocumento,
  };

  return (
    <div className="w-full space-y-6">
      {hasFirma === false && <SignatureAlert />}

      <div>
        <h1 className="text-lg font-semibold">Bandeja de Autorizaciones</h1>
        <p className="text-sm text-muted-foreground">
          Documentos de Educación Médica en flujo de autorización. Quien firma no edita: ejecuta la
          acción desde aquí o abre el documento para revisar el contexto completo.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'pendientes' | 'todos')}
        className="w-full"
      >
        <TabsList
          className={`grid h-12 w-full max-w-2xl border bg-background p-1 ${
            puedeVerTodos ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          <TabsTrigger
            value="pendientes"
            className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Pendientes
            <span className="group-data-[state=active]:bg-primary-foreground/20 ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:text-primary-foreground">
              {dataPendientes.length}
            </span>
          </TabsTrigger>
          {puedeVerTodos && (
            <TabsTrigger
              value="todos"
              className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Todos los documentos
              <span className="group-data-[state=active]:bg-primary-foreground/20 ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:text-primary-foreground">
                {dataTodos.length}
              </span>
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Buscar documento</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={draftFilters.busqueda}
                  onChange={(e) => updateDraft('busqueda', e.target.value)}
                  placeholder="Nombre o detalle..."
                  className="h-10 pl-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select
                value={draftFilters.tipo}
                onValueChange={(v) => updateDraft('tipo', v as FiltrosBandeja['tipo'])}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="seleccion">Selección mensual</SelectItem>
                  <SelectItem value="rutas">Rutas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <Select
                value={draftFilters.idEstado}
                onValueChange={(v) => updateDraft('idEstado', v)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {workflowEstados
                    .filter((e) => e.activo)
                    .sort((a, b) => a.idEstado - b.idEstado)
                    .map((e) => (
                      <SelectItem key={e.idEstado} value={String(e.idEstado)}>
                        {e.nombre ?? `Estado ${e.idEstado}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Etapa</label>
              <Select value={draftFilters.etapa} onValueChange={(v) => updateDraft('etapa', v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las etapas</SelectItem>
                  {etapasDisponibles.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fecha desde</label>
              <Input
                type="date"
                className="h-10"
                value={draftFilters.fechaDesde}
                onChange={(e) => updateDraft('fechaDesde', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fecha hasta</label>
              <Input
                type="date"
                className="h-10"
                value={draftFilters.fechaHasta}
                onChange={(e) => updateDraft('fechaHasta', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLimpiar}
              disabled={loadingCurrentTab}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Limpiar filtros
            </Button>
            <Button size="sm" onClick={handleBuscar} disabled={loadingCurrentTab}>
              <Search className="mr-1.5 h-4 w-4" />
              Buscar
            </Button>
          </div>
        </div>

        <TabsContent value="pendientes" className="mt-3 w-full">
          <BandejaTable
            data={documentosFiltrados}
            loading={loadingCurrentTab}
            title="Pendientes de tu firma"
            subtitle="Documentos donde participas en el paso actual"
            {...accionesBoton}
            onRefresh={() => void fetchTab('pendientes')}
          />
        </TabsContent>

        {puedeVerTodos && (
          <TabsContent value="todos" className="mt-3 w-full">
            <BandejaTable
              data={documentosFiltrados}
              loading={loadingCurrentTab}
              title="Todos los documentos"
              subtitle="Todos los documentos del módulo, incluidos los ya autorizados"
              {...accionesBoton}
              onRefresh={() => void fetchTab('todos')}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Modal: Detalle ── */}
      <Modal
        id="modal-bandeja-detalle"
        open={modalStates.detalle}
        setOpen={(o) => {
          if (!o) {
            toggleModal('detalle', false);
            setSeleccionado(null);
          }
        }}
        title={
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <span>{seleccionado?.documento ?? 'Detalle del documento'}</span>
          </div>
        }
        size="full"
        footer={
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {seleccionado && (
              <Button variant="outline" onClick={() => abrirDocumento(seleccionado)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir documento completo
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                toggleModal('detalle', false);
                setSeleccionado(null);
              }}
            >
              Cerrar
            </Button>
          </div>
        }
      >
        {cargandoDetalle ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : seleccionado ? (
          <div className="space-y-4">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resumen
              </h4>
              {seleccionado.tipo === 'seleccion' && seleccionDetalle && (
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Gerencia</p>
                    <p>{seleccionDetalle.tipoGerencia ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vigencia</p>
                    <p>
                      {formatearFecha(seleccionDetalle.fechaInicioVigencia)} —{' '}
                      {formatearFecha(seleccionDetalle.fechaFinVigencia)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p>{seleccionDetalle.estado}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hospitales</p>
                    <p>{seleccionDetalle.totalHospitales}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Regiones</p>
                    <p>{seleccionDetalle.totalRegiones}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Firmas</p>
                    <p>
                      GG:{' '}
                      {seleccionDetalle.firmaGgFecha
                        ? formatearFecha(seleccionDetalle.firmaGgFecha)
                        : 'Pendiente'}{' '}
                      · GV:{' '}
                      {seleccionDetalle.firmaGvFecha
                        ? formatearFecha(seleccionDetalle.firmaGvFecha)
                        : 'Pendiente'}
                    </p>
                  </div>
                </div>
              )}
              {seleccionado.tipo === 'rutas' && versionInfo && (
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Versión</p>
                    <p>v{versionInfo.version}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paso actual</p>
                    <p>{versionInfo.pasoNombre ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p>{versionInfo.estado}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Equipos</p>
                    <p>{equiposVersion}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hospitales planificados</p>
                    <p>
                      {hospitalesPlanificados}
                      {totalHospitalesSeleccion !== null ? ` / ${totalHospitalesSeleccion}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Visitas</p>
                    <p>{rutasVersion.reduce((acc, r) => acc + r.visitas.length, 0)}</p>
                  </div>
                </div>
              )}
              {seleccionado.tipo === 'rutas' && !versionInfo && !cargandoDetalle && (
                <p className="mt-2 text-sm text-muted-foreground">
                  No se pudo cargar la información de la versión.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </Modal>

      {/* ── Modales compartidos: Firma, Archivos, Historial ── */}
      {seleccionado && (
        <>
          <DocumentoFirmaModal
            open={modalStates.firma}
            onClose={() => {
              toggleModal('firma', false);
              setSeleccionado(null);
            }}
            documento={seleccionado.documento}
            estadoTexto={seleccionado.estadoNombre ?? seleccionado.estado ?? '—'}
            pasoNombre={seleccionado.pasoNombre}
            tipo={seleccionado.tipo}
            idEntidad={seleccionado.idEntidad}
            idPasoActual={seleccionado.idPasoActual}
            acciones={seleccionado.acciones}
            hasFirma={hasFirma ?? undefined}
            guardando={guardando}
            onConfirmar={confirmarAccion}
          />

          <DocumentoArchivosModal
            open={modalStates.archivos}
            onClose={() => {
              toggleModal('archivos', false);
              setSeleccionado(null);
            }}
            documento={seleccionado.documento}
            tipo={seleccionado.tipo}
            idEntidad={seleccionado.idEntidad}
          />

          <DocumentoHistorialModal
            open={modalStates.historial}
            onClose={() => {
              toggleModal('historial', false);
              setSeleccionado(null);
            }}
            documento={seleccionado.documento}
            estadoTexto={seleccionado.estadoNombre ?? seleccionado.estado ?? '—'}
            tipo={seleccionado.tipo}
            idEntidad={seleccionado.idEntidad}
            idWorkflow={seleccionado.idWorkflow}
            idPasoActual={seleccionado.idPasoActual}
          />
        </>
      )}
    </div>
  );
}
