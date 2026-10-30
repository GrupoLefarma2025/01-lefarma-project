import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Printer, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  AccionDisponible,
  ConcentracionEquipo,
  GuardarCostoRecursoRequest,
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
import { MatrizEnvioModal } from './MatrizEnvioModal';
import { SaludMatrizCard } from './SaludMatrizCard';
import { VisitasSinTallerTable } from './VisitasSinTallerTable';

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
  const [envioOpen, setEnvioOpen] = useState(false);
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
  const [enviando, setEnviando] = useState(false);

  const accionEnviar = useMemo<AccionDisponible | undefined>(
    () => matriz?.acciones.find((accion) => accion.tipoAccionCodigo === 'ENVIAR'),
    [matriz]
  );
  const accionesSinEnviar = useMemo<AccionDisponible[]>(
    () => matriz?.acciones.filter((accion) => accion.tipoAccionCodigo !== 'ENVIAR') ?? [],
    [matriz]
  );
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

  const enviarMatriz = useCallback(
    async (comentario: string): Promise<boolean> => {
      if (!accionEnviar || !matriz) return false;
      setEnviando(true);
      try {
        const response = await educacionMedicaApi.matricesTalleres.firmar(
          matriz.idMatrizGeneral,
          {
            idAccion: accionEnviar.idAccion,
            comentario: comentario || null,
            datosAdicionales:
              (revision?.visitasSinTaller ?? 0) > 0
                ? { confirmarVisitasSinTaller: true }
                : null,
          }
        );
        if (!response.data.success) {
          toast.error(response.data.message ?? 'No se pudo enviar la matriz');
          return false;
        }
        toast.success('Matriz enviada a autorización. La captura quedó cerrada.');
        await onReload();
        return true;
      } catch (err: unknown) {
        toast.error(toApiError(err).message ?? 'No se pudo enviar la matriz');
        return false;
      } finally {
        setEnviando(false);
      }
    },
    [accionEnviar, matriz, onReload, revision]
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
        showFirmar={accionesSinEnviar.length > 0}
        onFirmar={() => setFirmaOpen(true)}
        firmando={guardando}
        firmarDeshabilitado={hasFirma === false}
        showHistorial
        onHistorial={() => setHistorialOpen(true)}
        fondoClase="bg-emerald-50/60 dark:bg-emerald-950/20"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {accionEnviar && (
            <Button
              size="sm"
              className="gap-1.5 bg-[#eb6c36] text-white hover:bg-[#d95a2b]"
              onClick={() => setEnvioOpen(true)}
              disabled={enviando}
            >
              <Send className="h-4 w-4" />
              Enviar a autorización
            </Button>
          )}
          <Badge variant="outline" className="rounded-full text-[10px]">
            {matriz.esEditable ? 'Captura abierta' : 'Captura cerrada'}
          </Badge>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void abrirImpresion()}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <SaludMatrizCard revision={revision} capturaAbierta={matriz.esEditable} loading={loading} />

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
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
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
        acciones={accionesSinEnviar}
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

      <MatrizEnvioModal
        open={envioOpen}
        onClose={() => setEnvioOpen(false)}
        matriz={matriz}
        revision={revision}
        enviando={enviando}
        onConfirmar={enviarMatriz}
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
