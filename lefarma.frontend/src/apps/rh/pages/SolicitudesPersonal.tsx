import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Paperclip, History, RotateCcw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { useSolicitudesAutorizaciones, isEstadoTerminal } from '@/hooks/useSolicitudes';
import { Modal } from '@/components/ui/modal';
import { InlineLoader } from '@/components/ui/inline-loader';
import { SignatureAlert } from '@/components/common/SignatureAlert';
import { useAuthStore } from '@/shared/auth/authStore';
import { SolicitudesTable } from '../components/SolicitudesTable';
import { SolicitudAccionesModal } from '../components/SolicitudAccionesModal';
import { LimitesSolicitudCard } from '../components/LimitesSolicitudCard';
import { SolicitudHeaderCard } from '../components/SolicitudHeaderCard';
import { SolicitudDetalleTab } from '../components/SolicitudDetalleTab';
import { SolicitudArchivosTab } from '../components/SolicitudArchivosTab';
import { SolicitudFlujoTab } from '../components/SolicitudFlujoTab';
import { SolicitudPersonalPDF } from '../components/SolicitudPersonalPDF';
import { CrearSolicitud } from '../components/CrearSolicitud';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import type { WorkflowEstado } from '@/types/workflow.types';
import type { SolicitudPersonalResponse, SolicitudPersonalFilterParams } from '@/types/solicitudPersonal.types';
import { toast } from 'sonner';
import { calcularRangoPeriodo, PERIODOS } from '@/utils/date';

interface Filters {
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
}

export default function SolicitudesPersonal() {
  usePageTitle(
    'Solicitudes de Personal',
    'Solicitudes de personal para autorización y seguimiento'
  );
  const puedeEditar = usePermission({ require: 'solicitud_personal.puede_ver_todas_solicitudes' });
  const { hasFirma, fetchProfileSignature } = useAuthStore();

  const {
    solicitudesPropias,
    loading,
    fetchAll,
    selectedSolicitud,
    selectSolicitud,
    loadingDetalle,
    fetchDetalleCompleto,
    loadingAcciones,
    fetchAcciones,
    acciones,
    loadingHistorial,
    fetchHistorial,
    historial,
    pasosWorkflow,
    getEstadoInfo,
    firmar,
    isSubmittingFirma,
  } = useSolicitudesAutorizaciones();

  const rangoInicial = useMemo(() => calcularRangoPeriodo('esta-quincena'), []);

  const initialFilters: Filters = {
    periodo: 'esta-quincena',
    fechaInicio: rangoInicial.fechaInicio,
    fechaFin: rangoInicial.fechaFin,
    estado: 'all',
  };

  const [tab, setTab] = useState<'pendientes' | 'mias'>('pendientes');
  const [draftFiltersByTab, setDraftFiltersByTab] = useState<
    Record<'pendientes' | 'mias', Filters>
  >({
    pendientes: initialFilters,
    mias: initialFilters,
  });
  const [appliedFiltersByTab, setAppliedFiltersByTab] = useState<
    Record<'pendientes' | 'mias', Filters>
  >({
    pendientes: initialFilters,
    mias: initialFilters,
  });
  const [workflowEstados, setWorkflowEstados] = useState<WorkflowEstado[]>([]);

  const draftFilters = draftFiltersByTab[tab];
  const appliedFilters = appliedFiltersByTab[tab];

  const buildApiFilters = useCallback((filters: Filters): SolicitudPersonalFilterParams => {
    const params: SolicitudPersonalFilterParams = {
      periodo: filters.periodo,
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
    };

    if (filters.estado !== 'all') {
      params.idEstado = Number(filters.estado);
    }

    return params;
  }, []);

  useEffect(() => {
    fetchAll(false, buildApiFilters(appliedFilters));
    fetchProfileSignature();

    API.get<ApiResponse<WorkflowEstado[]>>('/config/workflows/estados')
      .then((estadosRes) => {
        if (estadosRes.data.success) setWorkflowEstados(estadosRes.data.data || []);
      })
      .catch(() => {
        setWorkflowEstados([]);
      });
  }, [appliedFilters, fetchAll, fetchProfileSignature, buildApiFilters]);

  const [modalStates, setModalStates] = useState({
    detalle: false,
    firma: false,
    archivos: false,
    historial: false,
    crear: false,
  });
  const [solicitudEnEdicion, setSolicitudEnEdicion] = useState<number | null>(null);
  const [imprimirSolicitud, setImprimirSolicitud] = useState(false);

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates((prev) => ({
      ...prev,
      [modalName]: state ?? !prev[modalName],
    }));
  };

  const closeModal = (modalName: keyof typeof modalStates) => {
    toggleModal(modalName, false);
    if (modalName !== 'crear') {
      selectSolicitud(null);
    }
    if (modalName === 'crear') {
      setSolicitudEnEdicion(null);
    }
  };

  useLayoutEffect(() => {
    if (!imprimirSolicitud || !selectedSolicitud || loadingDetalle || loadingHistorial) return;

    const handleBeforePrint = () => {
      document.body.classList.add('print-solicitud');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('print-solicitud');
      setImprimirSolicitud(false);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    window.print();
  }, [imprimirSolicitud, selectedSolicitud, loadingDetalle, loadingHistorial]);

  const handleOpenCrear = () => {
    if (hasFirma === false) {
      toast.warning('No has cargado tu firma digital', {
        description: 'Ve a Configuración {'>'} Perfil para subir tu firma y poder crear solicitudes.',
        duration: 6000,
      });
      return;
    }
    setSolicitudEnEdicion(null);
    toggleModal('crear', true);
  };

  const handleOpenEditar = (s: SolicitudPersonalResponse) => {
    if (hasFirma === false) {
      toast.warning('No has cargado tu firma digital', {
        description: 'Ve a Configuración {'>'} Perfil para subir tu firma y poder editar solicitudes.',
        duration: 6000,
      });
      return;
    }
    setSolicitudEnEdicion(s.idSolicitud);
    toggleModal('crear', true);
  };

  const updateDraft = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setDraftFiltersByTab((prev) => {
      const next = { ...prev[tab], [key]: value };
      if (key === 'periodo' && value !== 'personalizado') {
        const rango = calcularRangoPeriodo(value as string);
        next.fechaInicio = rango.fechaInicio;
        next.fechaFin = rango.fechaFin;
      }
      return { ...prev, [tab]: next };
    });
  };

  const handleBuscar = () => {
    if (draftFilters.periodo === 'personalizado') {
      if (!draftFilters.fechaInicio || !draftFilters.fechaFin) {
        toast.error('Selecciona la fecha de inicio y la fecha de fin.');
        return;
      }
    }
    setAppliedFiltersByTab((prev) => ({ ...prev, [tab]: draftFilters }));
  };

  const handleLimpiar = () => {
    setDraftFiltersByTab((prev) => ({ ...prev, [tab]: initialFilters }));
    setAppliedFiltersByTab((prev) => ({ ...prev, [tab]: initialFilters }));
  };

  const estados = useMemo(() => {
    const values = workflowEstados.filter((e) => e.activo).sort((a, b) => a.idEstado - b.idEstado);
    return ['all', ...values.map((e) => String(e.idEstado))];
  }, [workflowEstados]);

  const getEstadoInfoById = (idEstado: number | null | undefined) => {
    if (idEstado == null) return { nombre: 'Desconocido', color: '#94a3b8' };
    const e = workflowEstados.find((est) => est.idEstado === idEstado);
    return { nombre: e?.nombre ?? `Estado ${idEstado}`, color: e?.colorHex ?? '#94a3b8' };
  };

  const solicitudesPendientes = useMemo(
    () => solicitudesPropias.filter((s) => !isEstadoTerminal(s.estadoNombre)),
    [solicitudesPropias]
  );
  const solicitudesMias = useMemo(
    () => solicitudesPropias.filter((s) => isEstadoTerminal(s.estadoNombre)),
    [solicitudesPropias]
  );

  const handleOpenDetalle = (s: SolicitudPersonalResponse) => {
    selectSolicitud(s.idSolicitud);
    fetchDetalleCompleto(s.idSolicitud);
    toggleModal('detalle', true);
  };

  const handleOpenFirma = (s: SolicitudPersonalResponse) => {
    if (hasFirma === false) {
      toast.warning('No has cargado tu firma digital', {
        description: 'Ve a Configuración {'>'} Perfil para subir tu firma y poder firmar solicitudes.',
        duration: 6000,
      });
      return;
    }
    selectSolicitud(s.idSolicitud);
    fetchAcciones(s.idSolicitud);
    toggleModal('firma', true);
  };

  const handleOpenArchivos = (s: SolicitudPersonalResponse) => {
    selectSolicitud(s.idSolicitud);
    toggleModal('archivos', true);
  };

  const handleOpenHistorial = (s: SolicitudPersonalResponse) => {
    selectSolicitud(s.idSolicitud);
    fetchHistorial(s.idSolicitud);
    toggleModal('historial', true);
  };

  const handleImprimir = async (s: SolicitudPersonalResponse) => {
    selectSolicitud(s.idSolicitud);
    await fetchDetalleCompleto(s.idSolicitud);
    await fetchHistorial(s.idSolicitud);
    setImprimirSolicitud(true);
  };

  const accionesBoton = {
    onDetalle: handleOpenDetalle,
    onFirma: handleOpenFirma,
    onArchivos: handleOpenArchivos,
    onHistorial: handleOpenHistorial,
    onImprimir: handleImprimir,
    onEditar: handleOpenEditar,
  };

  return (
    <div className="w-full space-y-6">
      {hasFirma === false && <SignatureAlert />}

      <LimitesSolicitudCard titulo="Mis límites y saldo de vacaciones" />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'pendientes' | 'mias')}
        className="w-full"
      >
        <TabsList
          className="grid h-12 w-full max-w-2xl grid-cols-2 border bg-background p-1"
        >
          <TabsTrigger
            value="pendientes"
            className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Pendientes
            <span className="group-data-[state=active]:bg-primary-foreground/20 ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:text-primary-foreground">
              {solicitudesPendientes.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="mias"
            className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Mis solicitudes
            <span className="group-data-[state=active]:bg-primary-foreground/20 ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:text-primary-foreground">
              {solicitudesMias.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draftFilters.periodo}
                onChange={(e) => updateDraft('periodo', e.target.value)}
              >
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {draftFilters.periodo === 'personalizado' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fecha inicio</label>
                  <Input
                    type="date"
                    value={draftFilters.fechaInicio}
                    onChange={(e) => updateDraft('fechaInicio', e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fecha fin</label>
                  <Input
                    type="date"
                    value={draftFilters.fechaFin}
                    onChange={(e) => updateDraft('fechaFin', e.target.value)}
                    className="h-10"
                  />
                </div>
              </>
            )}

            {tab === 'mias' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draftFilters.estado}
                  onChange={(e) => updateDraft('estado', e.target.value)}
                >
                  {estados.map((e) => (
                    <option key={e} value={e}>
                      {e === 'all' ? 'Todos los estados' : getEstadoInfoById(Number(e)).nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleLimpiar} disabled={loading}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Limpiar filtros
              </Button>
              <Button size="sm" onClick={handleBuscar} disabled={loading}>
                {loading ? (
                  'Buscando...'
                ) : (
                  <>
                    <Search className="mr-1.5 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
            <Button onClick={handleOpenCrear} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Crear solicitud
            </Button>
          </div>
        </div>

        <TabsContent value="pendientes" className="mt-3 w-full">
          <SolicitudesTable
            data={solicitudesPendientes}
            loading={loading}
            title="Solicitudes pendientes"
            subtitle="Solicitudes que aún no se cierran, cancelan o rechazan"
            getEstadoInfo={getEstadoInfo}
            {...accionesBoton}
            showImprimir={false}
            onRefresh={() => fetchAll(false, buildApiFilters(appliedFilters))}
            puedeEditar={puedeEditar}
            globalFilter={true}
          />
        </TabsContent>

        <TabsContent value="mias" className="mt-3 w-full">
          <SolicitudesTable
            data={solicitudesMias}
            loading={loading}
            title="Mis solicitudes terminadas"
            subtitle="Cerradas, canceladas o rechazadas"
            getEstadoInfo={getEstadoInfo}
            {...accionesBoton}
            onRefresh={() => fetchAll(false, buildApiFilters(appliedFilters))}
            showFirma={false}
            showEditar={false}
            puedeEditar={puedeEditar}
            globalFilter={true}
          />
        </TabsContent>
      </Tabs>

      <Modal
        id="modal-solicitud-detalle"
        open={modalStates.detalle}
        setOpen={(o) => {
          if (!o) closeModal('detalle');
        }}
        title={
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>Detalle de solicitud</span>
          </div>
        }
        size="full"
      >
        {selectedSolicitud && (
          <div className="mb-4">
            <SolicitudHeaderCard solicitud={selectedSolicitud} getEstadoInfo={getEstadoInfo} />
          </div>
        )}
        {loadingDetalle && <InlineLoader message="Cargando detalle de la solicitud..." />}
        {!loadingDetalle && !selectedSolicitud && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Selecciona una solicitud para ver su detalle</p>
          </div>
        )}
        {!loadingDetalle && selectedSolicitud && (
          <SolicitudDetalleTab solicitud={selectedSolicitud} />
        )}
      </Modal>

      <SolicitudAccionesModal
        open={modalStates.firma}
        onClose={() => closeModal('firma')}
        loading={loadingAcciones}
        solicitud={selectedSolicitud}
        acciones={acciones}
        getEstadoInfo={getEstadoInfo}
        onFirmar={(req) => firmar(req, false, buildApiFilters(appliedFilters))}
        isSubmittingFirma={isSubmittingFirma}
        hasFirma={hasFirma ?? true}
      />

      <Modal
        id="modal-solicitud-archivos"
        open={modalStates.archivos}
        setOpen={(o) => {
          if (!o) closeModal('archivos');
        }}
        title={
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            <span>Archivos de solicitud</span>
          </div>
        }
        size="full"
      >
        {selectedSolicitud && (
          <div className="mb-4">
            <SolicitudHeaderCard solicitud={selectedSolicitud} getEstadoInfo={getEstadoInfo} />
          </div>
        )}
        {!selectedSolicitud && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <Paperclip className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Selecciona una solicitud para ver sus archivos</p>
          </div>
        )}
        {selectedSolicitud && <SolicitudArchivosTab idSolicitud={selectedSolicitud.idSolicitud} />}
      </Modal>

      <Modal
        id="modal-solicitud-historial"
        open={modalStates.historial}
        setOpen={(o) => {
          if (!o) closeModal('historial');
        }}
        title={
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <span>Historial de solicitud</span>
          </div>
        }
        size="full"
      >
        {selectedSolicitud && (
          <div className="mb-4">
            <SolicitudHeaderCard solicitud={selectedSolicitud} getEstadoInfo={getEstadoInfo} />
          </div>
        )}
        {loadingHistorial && <InlineLoader message="Cargando historial de la solicitud..." />}
        {!loadingHistorial && !selectedSolicitud && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <History className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Selecciona una solicitud para ver su historial</p>
          </div>
        )}
        {!loadingHistorial && selectedSolicitud && (
          <SolicitudFlujoTab
            solicitud={selectedSolicitud}
            pasosWorkflow={pasosWorkflow}
            historial={historial}
          />
        )}
      </Modal>

      <Modal
        id="modal-crear-solicitud"
        open={modalStates.crear}
        setOpen={(o) => {
          if (!o) closeModal('crear');
        }}
        title={
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <span>{solicitudEnEdicion ? 'Editar solicitud' : 'Crear solicitud'}</span>
          </div>
        }
        size="full"
      >
        <CrearSolicitud
          key={solicitudEnEdicion ?? 'new'}
          idSolicitud={solicitudEnEdicion ?? undefined}
          onClose={() => closeModal('crear')}
          onSaved={() => fetchAll(false)}
        />
      </Modal>

      {/* ── PDF Print Document — Solicitud de Personal ── */}
      {selectedSolicitud &&
        createPortal(
          <SolicitudPersonalPDF
            solicitud={selectedSolicitud}
            historial={historial}
            pasosWorkflow={pasosWorkflow}
          />,
          document.body
        )}
    </div>
  );
}
