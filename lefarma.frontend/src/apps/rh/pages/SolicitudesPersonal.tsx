import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Paperclip, History } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { useSolicitudesAutorizaciones, isEstadoTerminal } from '@/hooks/useSolicitudes';
import { Modal } from '@/components/ui/modal';
import { InlineLoader } from '@/components/ui/inline-loader';
import { SolicitudesTable } from '../components/SolicitudesTable';
import { SolicitudAccionesModal } from '../components/SolicitudAccionesModal';
import { SolicitudHeaderCard } from '../components/SolicitudHeaderCard';
import { SolicitudDetalleTab } from '../components/SolicitudDetalleTab';
import { SolicitudArchivosTab } from '../components/SolicitudArchivosTab';
import { SolicitudFlujoTab } from '../components/SolicitudFlujoTab';
import { CrearSolicitud } from '../components/CrearSolicitud';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import type { WorkflowEstado } from '@/types/workflow.types';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';

function BuscadorTab({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-3 w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </div>
  );
}

export default function SolicitudesPersonal() {
  usePageTitle('Solicitudes de Personal', 'Solicitudes de personal para autorización y seguimiento');
  const puedeVerTodas = usePermission({ require: 'solicitud_personal.puede_ver_todas_solcitudes' });

  const {
    solicitudesPropias,
    solicitudesTodas,
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

  const [tab, setTab] = useState<'pendientes' | 'mias' | 'todas'>('pendientes');
  const [searchPendientes, setSearchPendientes] = useState('');
  const [searchMias, setSearchMias] = useState('');
  const [searchTodas, setSearchTodas] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [creadorFilter, setCreadorFilter] = useState<number | 'all'>('all');
  const [workflowEstados, setWorkflowEstados] = useState<WorkflowEstado[]>([]);

  useEffect(() => {
    fetchAll(puedeVerTodas);

    API.get<ApiResponse<WorkflowEstado[]>>('/config/workflows/estados')
      .then((res) => {
        if (res.data.success) setWorkflowEstados(res.data.data || []);
      })
      .catch(() => {
        setWorkflowEstados([]);
      });
  }, [puedeVerTodas, fetchAll]);

  const [modalStates, setModalStates] = useState({
    detalle: false,
    firma: false,
    archivos: false,
    historial: false,
    crear: false,
  });

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
  };

  const allSolicitudes = useMemo(
    () => Array.from(new Map([...solicitudesPropias, ...solicitudesTodas].map((s) => [s.idSolicitud, s])).values()),
    [solicitudesPropias, solicitudesTodas]
  );

  const estados = useMemo(() => {
    const values = workflowEstados.filter((e) => e.activo).sort((a, b) => a.idEstado - b.idEstado);
    return ['all', ...values.map((e) => String(e.idEstado))];
  }, [workflowEstados]);

  const creadores = useMemo(() => {
    const map = new Map<number, string>();
    allSolicitudes.forEach((s) => {
      if (s.idUsuarioCreador && s.solicitanteNombre) {
        map.set(s.idUsuarioCreador, s.solicitanteNombre);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, nombre]) => ({ id, nombre }));
  }, [allSolicitudes]);

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

  const applyFilters = (list: SolicitudPersonalResponse[], q: string) => {
    const term = q.trim().toLowerCase();
    return list.filter(
      (s) => {
        const matchSearch = term.length === 0 ||
          s.folio.toLowerCase().includes(term) ||
          (s.solicitanteNombre ?? '').toLowerCase().includes(term) ||
          (s.tipoSolicitudNombre ?? '').toLowerCase().includes(term);
        const matchEstado = estadoFilter === 'all' || s.idEstado === Number(estadoFilter);
        const matchCreador = creadorFilter === 'all' || s.idUsuarioCreador === creadorFilter;
        return matchSearch && matchEstado && matchCreador;
      }
    );
  };

  const filteredPendientes = applyFilters(solicitudesPendientes, searchPendientes);
  const filteredMias = applyFilters(solicitudesMias, searchMias);
  const filteredTodas = applyFilters(solicitudesTodas, searchTodas);

  const handleOpenDetalle = (s: SolicitudPersonalResponse) => {
    selectSolicitud(s.idSolicitud);
    fetchDetalleCompleto(s.idSolicitud);
    toggleModal('detalle', true);
  };

  const handleOpenFirma = (s: SolicitudPersonalResponse) => {
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

  const handleOpenCrear = () => {
    toggleModal('crear', true);
  };

  const accionesBoton = {
    onDetalle: handleOpenDetalle,
    onFirma: handleOpenFirma,
    onArchivos: handleOpenArchivos,
    onHistorial: handleOpenHistorial,
  };

  return (
    <div className="w-full space-y-6">
      {puedeVerTodas && (
        <p className="text-xs text-muted-foreground">
          Tienes permiso para ver todas las solicitudes.
        </p>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'pendientes' | 'mias' | 'todas')} className="w-full">
        <TabsList className={`grid h-12 w-full max-w-2xl ${puedeVerTodas ? 'grid-cols-3' : 'grid-cols-2'} bg-background border p-1`}>
          <TabsTrigger
            value="pendientes"
            className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Pendientes
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground">
              {filteredPendientes.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="mias"
            className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Mis solicitudes
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground">
              {filteredMias.length}
            </span>
          </TabsTrigger>
          {puedeVerTodas && (
            <TabsTrigger
              value="todas"
              className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Todas
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground">
                {filteredTodas.length}
              </span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="pendientes" className="mt-3 w-full">
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <BuscadorTab
                value={searchPendientes}
                onChange={setSearchPendientes}
                placeholder="Buscar por folio, solicitante o tipo"
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
            >
              {estados.map((e) => (
                <option key={e} value={e}>
                  {e === 'all' ? 'Todos los estados' : getEstadoInfoById(Number(e)).nombre}
                </option>
              ))}
            </select>
            {puedeVerTodas && (
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={creadorFilter}
                onChange={(e) => setCreadorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">Todos los creadores</option>
                {creadores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mb-3 flex justify-end">
            <Button onClick={handleOpenCrear} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Crear solicitud
            </Button>
          </div>
          <SolicitudesTable
            data={filteredPendientes}
            loading={loading}
            title="Solicitudes pendientes"
            subtitle="Solicitudes que aún no se cierran, cancelan o rechazan"
            getEstadoInfo={getEstadoInfo}
            {...accionesBoton}
            onRefresh={() => fetchAll(puedeVerTodas)}
          />
        </TabsContent>

        <TabsContent value="mias" className="mt-3 w-full">
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <BuscadorTab
                value={searchMias}
                onChange={setSearchMias}
                placeholder="Buscar por folio, solicitante o tipo"
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
            >
              {estados.map((e) => (
                <option key={e} value={e}>
                  {e === 'all' ? 'Todos los estados' : getEstadoInfoById(Number(e)).nombre}
                </option>
              ))}
            </select>
            {puedeVerTodas && (
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={creadorFilter}
                onChange={(e) => setCreadorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">Todos los creadores</option>
                {creadores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mb-3 flex justify-end">
            <Button onClick={handleOpenCrear} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Crear solicitud
            </Button>
          </div>
          <SolicitudesTable
            data={filteredMias}
            loading={loading}
            title="Mis solicitudes terminadas"
            subtitle="Cerradas, canceladas o rechazadas"
            getEstadoInfo={getEstadoInfo}
            {...accionesBoton}
            onRefresh={() => fetchAll(puedeVerTodas)}
            showFirma={false}
          />
        </TabsContent>

        {puedeVerTodas && (
          <TabsContent value="todas" className="mt-3 w-full">
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <BuscadorTab
                  value={searchTodas}
                  onChange={setSearchTodas}
                  placeholder="Buscar por folio, solicitante o tipo"
                />
              </div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
              >
                {estados.map((e) => (
                  <option key={e} value={e}>
                    {e === 'all' ? 'Todos los estados' : getEstadoInfoById(Number(e)).nombre}
                  </option>
                ))}
              </select>
              {puedeVerTodas && (
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={creadorFilter}
                  onChange={(e) => setCreadorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value="all">Todos los creadores</option>
                  {creadores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="mb-3 flex justify-end">
              <Button onClick={handleOpenCrear} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Crear solicitud
              </Button>
            </div>
            <SolicitudesTable
              data={filteredTodas}
              loading={loading}
              title="Todas las solicitudes"
              subtitle="Listado completo sin filtros de estado"
              getEstadoInfo={getEstadoInfo}
              {...accionesBoton}
              onRefresh={() => fetchAll(puedeVerTodas)}
              showFirma={false}
            />
          </TabsContent>
        )}
      </Tabs>

      <Modal
        id="modal-solicitud-detalle"
        open={modalStates.detalle}
        setOpen={(o) => { if (!o) closeModal('detalle'); }}
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
        onFirmar={(req) => firmar(req, puedeVerTodas)}
        isSubmittingFirma={isSubmittingFirma}
      />

      <Modal
        id="modal-solicitud-archivos"
        open={modalStates.archivos}
        setOpen={(o) => { if (!o) closeModal('archivos'); }}
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
        setOpen={(o) => { if (!o) closeModal('historial'); }}
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
        setOpen={(o) => { if (!o) closeModal('crear'); }}
        title={
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <span>Crear solicitud</span>
          </div>
        }
        size="full"
      >
        <CrearSolicitud onClose={() => closeModal('crear')} onSaved={() => fetchAll(puedeVerTodas)} />
      </Modal>
    </div>
  );
}
