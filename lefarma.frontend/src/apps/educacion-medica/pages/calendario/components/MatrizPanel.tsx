import { useCallback, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/shared/auth/authStore';
import { toApiError } from '@/utils/errors';
import { DocumentoFirmaModal } from '@/apps/educacion-medica/components/DocumentoFirmaModal';
import { DocumentoHeaderCard } from '@/apps/educacion-medica/components/DocumentoHeaderCard';
import { DocumentoHistorialModal } from '@/apps/educacion-medica/components/DocumentoHistorialModal';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  ConcentracionEquipo,
  GuardarCostoRecursoRequest,
  MatrizAjustePostCierre,
  MatrizDocumento,
  MatrizRevision,
  MatrizTalleresDetalle,
  Taller,
  VisitaSinTaller,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import type { AccionWorkflow } from '@/components/workflows/workflowAccion';
import { MatrizCostosEditor } from '../../taller/components/MatrizCostosEditor';
import { MatrizEquiposTable } from '../../taller/components/MatrizEquiposTable';
import { MatrizPrintDocument } from '../../taller/components/MatrizPrintDocument';
import { MatrizTalleresTable } from '../../taller/components/MatrizTalleresTable';
import { ResolverSolicitudCambioModal } from '../../taller/components/ResolverSolicitudCambioModal';
import {
  TallerDetalleModal,
  type UbicacionDetalle,
} from '../../taller/components/TallerDetalleModal';
import { TallerAsistenciaModal } from '../../taller/components/TallerAsistenciaModal';
import { TallerEvidenciasModal } from '../../taller/components/TallerEvidenciasModal';
import { TallerMaterialModal } from '../../taller/components/TallerMaterialModal';
import { SaludMatrizCard } from './SaludMatrizCard';
import { VisitasSinTallerTable } from './VisitasSinTallerTable';

const ETIQUETAS_AJUSTE: Record<string, string> = {
  MOVER_VISITA: 'Mover visita',
  EDITAR_HORAS: 'Editar horas',
  EDITAR_EJECUTIVO: 'Editar ejecutivo',
  ALTA_VISITA: 'Alta de visita',
  BAJA_VISITA: 'Baja de visita',
  EDITAR_TALLER: 'Editar taller',
  CANCELAR_VERSION: 'Cancelar versión',
};

const formatearFechaAjuste = (fecha: string) => {
  const date = new Date(fecha);
  return Number.isNaN(date.getTime())
    ? fecha
    : date.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

function AjustesPostCierreCard({ ajustes }: { ajustes: MatrizAjustePostCierre[] }) {
  if (ajustes.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            Ajustes post-cierre
          </p>
          <p className="mt-0.5 text-[10px] text-amber-700/80 dark:text-amber-300/80">
            Cambios operativos posteriores a la autorización; no reabren la matriz.
          </p>
        </div>
        <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          {ajustes.length}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[11px]">
          <thead className="text-[9px] uppercase tracking-wide text-amber-700/70 dark:text-amber-300/70">
            <tr>
              <th className="pb-1.5 pr-3 font-semibold">Fecha</th>
              <th className="pb-1.5 pr-3 font-semibold">Hospital / taller</th>
              <th className="pb-1.5 pr-3 font-semibold">Cambio</th>
              <th className="pb-1.5 pr-3 font-semibold">Antes → después</th>
              <th className="pb-1.5 pr-3 font-semibold">Motivo</th>
              <th className="pb-1.5 font-semibold">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-200/60 text-slate-600 dark:divide-amber-900/40 dark:text-slate-300">
            {ajustes.map((ajuste) => (
              <tr key={ajuste.idAjuste}>
                <td className="whitespace-nowrap py-2 pr-3">
                  {formatearFechaAjuste(ajuste.fechaAjuste)}
                </td>
                <td className="max-w-[180px] truncate py-2 pr-3">
                  {ajuste.hospital ?? (ajuste.idTaller ? `Taller ${ajuste.idTaller}` : ajuste.entidadTipo)}
                </td>
                <td className="py-2 pr-3">{ETIQUETAS_AJUSTE[ajuste.accion] ?? ajuste.accion}</td>
                <td className="max-w-[200px] py-2 pr-3">
                  <span className="block truncate font-mono text-[10px]" title={ajuste.valoresAntes ?? ''}>
                    {ajuste.valoresAntes ?? '—'}
                  </span>
                  <span className="block truncate font-mono text-[10px]" title={ajuste.valoresDespues ?? ''}>
                    {ajuste.valoresDespues ?? '—'}
                  </span>
                </td>
                <td className="max-w-[220px] truncate py-2 pr-3" title={ajuste.motivo}>
                  {ajuste.motivo}
                </td>
                <td className="whitespace-nowrap py-2">
                  {ajuste.nombreUsuario ?? `Usuario ${ajuste.idUsuario}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface MatrizPanelProps {
  idGerencia: number | null;
  periodo: string;
  matriz: MatrizTalleresDetalle | null;
  concentracion: ConcentracionEquipo[];
  revision: MatrizRevision | null;
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
  onCrearTallerParaVisita: (visita: VisitaSinTaller) => void;
  onVerVisita: (visita: VisitaSinTaller) => void;
  onVerCalendario: () => void;
}

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtPeriodo = (periodo: string) => periodo.slice(0, 7).split('-').reverse().join('/');

export function MatrizPanel({
  idGerencia,
  periodo,
  matriz,
  concentracion,
  revision,
  loading,
  error,
  onReload,
  onCrearTallerParaVisita,
  onVerVisita,
  onVerCalendario,
}: MatrizPanelProps) {
  const { hasFirma } = useAuthStore();
  const puedeCapturar = usePermission({
    require: 'educacion_medica.talleres.puede_capturar',
  });
  const puedeCapturarAsistida = usePermission({
    require: 'educacion_medica.talleres.puede_capturar_asistida',
  });
  const puedeGestionarMaterial = usePermission({
    require: 'educacion_medica.materiales.puede_gestionar',
  });
  const puedeConfirmarMaterial = usePermission({
    require: 'educacion_medica.materiales.puede_confirmar',
  });
  const puedeGestionarEvidencias = usePermission({
    require: 'educacion_medica.evidencias.puede_gestionar',
  });

  const [tab, setTab] = useState<'equipos' | 'hospitales' | 'visitas'>('equipos');
  const [firmaOpen, setFirmaOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [documento, setDocumento] = useState<MatrizDocumento | null>(null);
  const [costosTaller, setCostosTaller] = useState<Taller | null>(null);
  const [detalleTaller, setDetalleTaller] = useState<Taller | null>(null);
  const [ubicacionDetalle, setUbicacionDetalle] = useState<UbicacionDetalle | null>(null);
  const [materialTaller, setMaterialTaller] = useState<Taller | null>(null);
  const [asistenciaTaller, setAsistenciaTaller] = useState<Taller | null>(null);
  const [evidenciasTaller, setEvidenciasTaller] = useState<Taller | null>(null);
  const [resolverTaller, setResolverTaller] = useState<Taller | null>(null);
  const [equipoDetalle, setEquipoDetalle] = useState<ConcentracionEquipo | null>(null);
  const [guardando, setGuardando] = useState(false);

  const puedeEditarCostos = matriz?.pasoNombre?.toLowerCase().includes('costo') ?? false;
  const contarVisitasSinTaller = useCallback(
    (equipo: ConcentracionEquipo) => {
      const visitas = revision?.visitasSinTallerDetalle ?? [];
      if (equipo.idEjecutivo != null && equipo.idEspecialista != null) {
        return visitas.filter(
          (visita) =>
            visita.idEjecutivo === equipo.idEjecutivo &&
            visita.idEspecialista === equipo.idEspecialista
        ).length;
      }
      if (equipo.idEjecutivo != null) {
        return visitas.filter((visita) => visita.idEjecutivo === equipo.idEjecutivo).length;
      }
      if (equipo.idEspecialista != null) {
        return visitas.filter((visita) => visita.idEspecialista === equipo.idEspecialista).length;
      }
      return 0;
    },
    [revision]
  );
  const documentoNombre = matriz
    ? `Matriz de talleres ${fmtPeriodo(matriz.periodo)} – ${matriz.gerencia ?? ''}`
    : 'Matriz de talleres';

  const confirmarAccion = useCallback(
    async (
      accion: AccionWorkflow,
      comentario?: string,
      datosAdicionales?: Record<string, unknown> | null
    ): Promise<boolean> => {
      if (!matriz) return false;
      setGuardando(true);
      try {
        const response = await educacionMedicaApi.matricesTalleres.firmar(
          matriz.idMatrizGeneral,
          {
            idAccion: accion.idAccion,
            comentario: comentario ?? null,
            datosAdicionales: datosAdicionales ?? null,
          }
        );
        if (!response.data.success) {
          toast.error(response.data.message ?? 'No se pudo aplicar la acción');
          return false;
        }
        toast.success(response.data.message ?? 'Acción registrada.');
        await onReload();
        return true;
      } catch (err: unknown) {
        toast.error(toApiError(err).message ?? 'No se pudo aplicar la acción');
        return false;
      } finally {
        setGuardando(false);
      }
    },
    [matriz, onReload]
  );

  const guardarCostos = useCallback(
    async (idTaller: number, recursos: GuardarCostoRecursoRequest[]) => {
      if (!matriz) return;
      setGuardando(true);
      try {
        const response = await educacionMedicaApi.matricesTalleres.actualizarCostos(
          matriz.idMatrizGeneral,
          idTaller,
          { recursos }
        );
        if (!response.data.success) {
          toast.error(response.data.message ?? 'No se pudieron registrar los costos');
          return;
        }
        toast.success('Costos registrados.');
        setCostosTaller(null);
        await onReload();
      } catch (err: unknown) {
        toast.error(toApiError(err).message ?? 'No se pudieron registrar los costos');
      } finally {
        setGuardando(false);
      }
    },
    [matriz, onReload]
  );

  const abrirImpresion = useCallback(async () => {
    if (!matriz) return;
    setDocumento(null);
    setPrintOpen(true);
    try {
      const response = await educacionMedicaApi.matricesTalleres.documento(
        matriz.idMatrizGeneral
      );
      if (response.data.success) setDocumento(response.data.data ?? null);
    } catch (err: unknown) {
      toast.error(toApiError(err).message ?? 'No se pudo cargar el documento');
    }
  }, [matriz]);

  const abrirDetalleTaller = useCallback(async (taller: Taller) => {
    setDetalleTaller(taller);
    setUbicacionDetalle({ nombreRegion: taller.region });
    if (taller.idHospital == null) return;
    try {
      const response = await educacionMedicaApi.hospitales.getById(taller.idHospital);
      if (response.data.success && response.data.data) {
        const hospital = response.data.data;
        setUbicacionDetalle({
          nombreRegion: taller.region,
          institucion: hospital.institucion,
          latitud: hospital.latitud,
          longitud: hospital.longitud,
        });
      }
    } catch {
      // Sin datos del catálogo: el modal cae a los datos del taller.
    }
  }, []);

  const cerrarDetalleTaller = useCallback(() => {
    setDetalleTaller(null);
    setUbicacionDetalle(null);
  }, []);

  if (idGerencia == null) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-card px-6 text-center dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Selecciona una gerencia para ver la matriz
        </p>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          La matriz se organiza por gerencia y mes. Usa el filtro de gerencia del Panel de rutas.
        </p>
      </div>
    );
  }

  if (loading && !matriz) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-card dark:border-slate-800">
        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando matriz…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 text-center dark:border-rose-900 dark:bg-rose-950/20">
        <AlertTriangle className="h-5 w-5 text-rose-500" />
        <p className="mt-2 text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void onReload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!matriz) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-card px-6 text-center dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No hay matriz de talleres para {fmtPeriodo(periodo)}
        </p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
          La matriz se crea automáticamente al capturar el primer taller de la gerencia en el mes.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onVerCalendario}>
          Ir al calendario
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DocumentoHeaderCard
        titulo={documentoNombre}
        pasoNombre={matriz.pasoNombre}
        estadoNombre={matriz.estadoNombre}
        estadoColor={matriz.estadoColor}
        detalle={`${matriz.totalTalleres} taller(es) · ${fmtMoneda(matriz.costoTotal)}`}
        showFirmar={matriz.acciones.length > 0}
        onFirmar={() => setFirmaOpen(true)}
        firmando={guardando}
        firmarDeshabilitado={hasFirma === false}
        showImprimir
        onImprimir={() => void abrirImpresion()}
        showHistorial
        onHistorial={() => setHistorialOpen(true)}
        fondoClase="bg-emerald-50/60 dark:bg-emerald-950/20"
      />

      <SaludMatrizCard revision={revision} loading={loading} />

      <AjustesPostCierreCard ajustes={matriz.ajustesPostCierre ?? []} />

      <Tabs value={tab} onValueChange={(valor) => setTab(valor as typeof tab)} className="w-full">
        <TabsList className="grid h-11 w-full max-w-xl grid-cols-3 border bg-background p-1">
          <TabsTrigger value="equipos" className="text-xs font-semibold">
            Por equipo
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-foreground">
              {concentracion.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="hospitales" className="text-xs font-semibold">
            Hospitales
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-foreground">
              {matriz.totalTalleres}
            </span>
          </TabsTrigger>
          <TabsTrigger value="visitas" className="text-xs font-semibold">
            Visitas sin taller
            {(revision?.visitasSinTaller ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {revision?.visitasSinTaller}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipos" className="mt-3">
          <MatrizEquiposTable
            equipos={concentracion}
            talleres={matriz.talleres}
            loading={loading}
            visitasSinTaller={contarVisitasSinTaller}
            onVerDetalle={setEquipoDetalle}
          />
        </TabsContent>

        <TabsContent value="hospitales" className="mt-3">
          <MatrizTalleresTable
            talleres={matriz.talleres}
            ajustesPostCierre={matriz.ajustesPostCierre ?? []}
            loading={loading}
            puedeEditarCostos={puedeEditarCostos}
            onEditarCostos={setCostosTaller}
            onVerDetalle={(taller) => void abrirDetalleTaller(taller)}
            onMaterial={setMaterialTaller}
            onAsistencias={setAsistenciaTaller}
            onEvidencias={setEvidenciasTaller}
            onResolverSolicitud={setResolverTaller}
            onRefresh={() => void onReload()}
          />
        </TabsContent>

        <TabsContent value="visitas" className="mt-3">
          <VisitasSinTallerTable
            visitas={revision?.visitasSinTallerDetalle ?? []}
            loading={loading}
            puedeCrear={matriz.esEditable && (puedeCapturar || puedeCapturarAsistida)}
            onCrearTaller={onCrearTallerParaVisita}
            onVerVisita={onVerVisita}
          />
        </TabsContent>
      </Tabs>

      <DocumentoFirmaModal
        open={firmaOpen}
        onClose={() => setFirmaOpen(false)}
        documento={documentoNombre}
        estadoTexto={matriz.estadoNombre ?? '—'}
        pasoNombre={matriz.pasoNombre}
        tipo="matriz"
        idEntidad={matriz.idMatrizGeneral}
        idPasoActual={matriz.idPasoActual}
        acciones={matriz.acciones}
        hasFirma={hasFirma ?? undefined}
        guardando={guardando}
        onConfirmar={confirmarAccion}
      />

      <DocumentoHistorialModal
        open={historialOpen}
        onClose={() => setHistorialOpen(false)}
        documento={documentoNombre}
        estadoTexto={matriz.estadoNombre ?? '—'}
        tipo="matriz"
        idEntidad={matriz.idMatrizGeneral}
        idWorkflow={matriz.idWorkflow}
        idPasoActual={matriz.idPasoActual}
      />

      <MatrizCostosEditor
        open={costosTaller !== null}
        onClose={() => setCostosTaller(null)}
        taller={costosTaller}
        guardando={guardando}
        onGuardar={guardarCostos}
      />

      <MatrizPrintDocument open={printOpen} onOpenChange={setPrintOpen} documento={documento} />

      <TallerDetalleModal
        open={detalleTaller !== null}
        onClose={cerrarDetalleTaller}
        taller={detalleTaller}
        tipoVisita={detalleTaller?.tipoVisita ?? null}
        ubicacion={ubicacionDetalle}
      />

      <Modal
        id="modal-equipo-matriz-detalle"
        open={equipoDetalle !== null}
        setOpen={(abierto) => {
          if (!abierto) setEquipoDetalle(null);
        }}
        title={`Talleres del equipo ${
          equipoDetalle
            ? `${equipoDetalle.nombreEjecutivo ?? 'EV'} + ${equipoDetalle.nombreEspecialista ?? 'EP'}`
            : ''
        }`}
        size="wide"
        footer={
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setEquipoDetalle(null)}>
              Cerrar
            </Button>
          </div>
        }
      >
        <MatrizTalleresTable
          talleres={matriz.talleres.filter(
            (taller) => taller.idMatrizIndividual === equipoDetalle?.idMatrizIndividual
          )}
          ajustesPostCierre={matriz.ajustesPostCierre ?? []}
          loading={loading}
          puedeEditarCostos={puedeEditarCostos}
          onEditarCostos={setCostosTaller}
          onVerDetalle={(taller) => void abrirDetalleTaller(taller)}
          onMaterial={setMaterialTaller}
          onAsistencias={setAsistenciaTaller}
          onEvidencias={setEvidenciasTaller}
          onResolverSolicitud={setResolverTaller}
        />
      </Modal>

      <TallerMaterialModal
        open={materialTaller !== null}
        onClose={() => setMaterialTaller(null)}
        taller={materialTaller}
        puedeGestionar={puedeGestionarMaterial}
        puedeConfirmar={puedeConfirmarMaterial}
        onChanged={() => void onReload()}
      />

      <TallerAsistenciaModal
        open={asistenciaTaller !== null}
        onClose={() => setAsistenciaTaller(null)}
        taller={asistenciaTaller}
        puedeCapturar={false}
        onChanged={() => void onReload()}
      />

      <TallerEvidenciasModal
        open={evidenciasTaller !== null}
        onClose={() => setEvidenciasTaller(null)}
        taller={evidenciasTaller}
        puedeGestionar={puedeGestionarEvidencias}
        onChanged={() => void onReload()}
      />

      <ResolverSolicitudCambioModal
        open={resolverTaller !== null}
        onClose={() => setResolverTaller(null)}
        taller={resolverTaller}
        solicitud={resolverTaller?.solicitudCambioPendiente ?? null}
        onResolved={() => void onReload()}
      />
    </div>
  );
}
