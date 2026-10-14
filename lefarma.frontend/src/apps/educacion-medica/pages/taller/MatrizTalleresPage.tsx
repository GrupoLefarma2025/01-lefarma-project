import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  ConcentracionEquipo,
  GuardarCostoRecursoRequest,
  MatrizDocumento,
  MatrizGeneralResumen,
  MatrizTalleresDetalle,
  Taller,
  TipoGerencia,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import type { AccionWorkflow } from '@/components/workflows/workflowAccion';
import { DocumentoHeaderCard } from '@/apps/educacion-medica/components/DocumentoHeaderCard';
import { DocumentoFirmaModal } from '@/apps/educacion-medica/components/DocumentoFirmaModal';
import { DocumentoHistorialModal } from '@/apps/educacion-medica/components/DocumentoHistorialModal';
import { MatrizEquiposTable } from './components/MatrizEquiposTable';
import { MatrizTalleresTable } from './components/MatrizTalleresTable';
import { MatrizCostosEditor } from './components/MatrizCostosEditor';
import { MatrizPrintDocument } from './components/MatrizPrintDocument';
import { TallerMaterialModal } from './components/TallerMaterialModal';
import { TallerAsistenciaModal } from './components/TallerAsistenciaModal';
import { TallerEvidenciasModal } from './components/TallerEvidenciasModal';
import { ResolverSolicitudCambioModal } from './components/ResolverSolicitudCambioModal';
import {
  TallerDetalleModal,
  type UbicacionDetalle,
} from './components/TallerDetalleModal';

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

const fmtPeriodo = (periodo: string) => periodo.slice(0, 7).split('-').reverse().join('/');

export default function MatrizTalleresPage() {
  usePageTitle('Matriz de talleres', 'Educación Médica');

  const { hasFirma } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const puedeReabrirCaptura = usePermission({
    require: 'educacion_medica.talleres.puede_revisar',
  });
  const puedeGestionarMaterial = usePermission({
    require: 'educacion_medica.materiales.puede_gestionar',
  });
  const puedeConfirmarMaterial = usePermission({
    require: 'educacion_medica.materiales.puede_confirmar',
  });

  const hoy = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(() => hoy.getMonth() + 1);
  const [anio, setAnio] = useState(() => hoy.getFullYear());
  const aniosDisponibles = useMemo(
    () => [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1],
    [hoy]
  );
  const periodo = useMemo(() => `${anio}-${String(mes).padStart(2, '0')}`, [anio, mes]);

  const [gerencias, setGerencias] = useState<TipoGerencia[]>([]);
  const [idGerencia, setIdGerencia] = useState<number | null>(null);

  const [matrices, setMatrices] = useState<MatrizGeneralResumen[]>([]);
  const [loadingMatrices, setLoadingMatrices] = useState(true);
  const [idMatrizSeleccionada, setIdMatrizSeleccionada] = useState<number | null>(null);

  const [detalle, setDetalle] = useState<MatrizTalleresDetalle | null>(null);
  const [concentracion, setConcentracion] = useState<ConcentracionEquipo[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(true);

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
  const [equipoReabrir, setEquipoReabrir] = useState<ConcentracionEquipo | null>(null);
  const [equipoDetalle, setEquipoDetalle] = useState<ConcentracionEquipo | null>(null);
  const [vista, setVista] = useState<'equipos' | 'hospitales'>('equipos');
  const [guardando, setGuardando] = useState(false);

  // Catálogo de gerencias (solo las que participan de la logística).
  useEffect(() => {
    let cancelado = false;
    educacionMedicaApi.tipoGerencia
      .getAll()
      .then((res) => {
        if (cancelado || !res.data.success) return;
        const permitidas = (res.data.data ?? []).filter(
          (g) => g.descripcion === 'IMSS' || g.descripcion === 'Descentralizado'
        );
        setGerencias(permitidas);
        setIdGerencia((prev) => prev ?? permitidas[0]?.idTipoGerencia ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelado) toast.error(toApiError(error).message ?? 'Error al cargar gerencias');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const idSeleccionadoRef = useRef<number | null>(null);

  const fetchMatrices = useCallback(async () => {
    if (idGerencia == null) return;
    try {
      const response = await educacionMedicaApi.matricesTalleres.getAll(idGerencia, periodo);
      if (response.data.success) {
        const lista = response.data.data ?? [];
        setMatrices(lista);
        const idUrl = Number(searchParams.get('idMatriz')) || null;
        const previo = idSeleccionadoRef.current;
        const candidato = idUrl && lista.some((m) => m.idMatrizGeneral === idUrl)
          ? idUrl
          : previo && lista.some((m) => m.idMatrizGeneral === previo)
            ? previo
            : (lista[0]?.idMatrizGeneral ?? null);
        if (candidato !== previo) {
          setDetalle(null);
          setConcentracion([]);
          setLoadingDetalle(true);
        }
        idSeleccionadoRef.current = candidato;
        setIdMatrizSeleccionada(candidato);
      } else {
        toast.error(response.data.message ?? 'Error al cargar las matrices');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar las matrices');
    } finally {
      setLoadingMatrices(false);
    }
    // searchParams se lee solo al cargar; la URL se sincroniza al seleccionar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idGerencia, periodo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; los setState ocurren tras el await
    void fetchMatrices();
  }, [fetchMatrices]);

  const fetchDetalle = useCallback(async (idMatrizGeneral: number) => {
    try {
      const [detRes, concRes] = await Promise.all([
        educacionMedicaApi.matricesTalleres.getById(idMatrizGeneral),
        educacionMedicaApi.matricesTalleres.concentracion(idMatrizGeneral),
      ]);
      if (detRes.data.success) {
        setDetalle(detRes.data.data ?? null);
      } else {
        toast.error(detRes.data.message ?? 'Error al cargar la matriz');
      }
      if (concRes.data.success) setConcentracion(concRes.data.data ?? []);
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar la matriz');
    } finally {
      setLoadingDetalle(false);
    }
  }, []);

  useEffect(() => {
    if (idMatrizSeleccionada == null) return;
    idSeleccionadoRef.current = idMatrizSeleccionada;
    setSearchParams({ idMatriz: String(idMatrizSeleccionada) }, { replace: true });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar de matriz; los setState ocurren tras el await
    void fetchDetalle(idMatrizSeleccionada);
  }, [idMatrizSeleccionada, fetchDetalle, setSearchParams]);

  const seleccionarMatriz = (id: number) => {
    if (id === idMatrizSeleccionada) return;
    setDetalle(null);
    setConcentracion([]);
    setLoadingDetalle(true);
    setIdMatrizSeleccionada(id);
  };

  const recargar = async () => {
    setLoadingMatrices(true);
    setLoadingDetalle(true);
    await fetchMatrices();
    if (idMatrizSeleccionada != null) await fetchDetalle(idMatrizSeleccionada);
  };

  const confirmarAccion = async (
    accion: AccionWorkflow,
    comentario?: string,
    datosAdicionales?: Record<string, unknown> | null
  ): Promise<boolean> => {
    if (idMatrizSeleccionada == null) return false;
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.matricesTalleres.firmar(idMatrizSeleccionada, {
        idAccion: accion.idAccion,
        comentario: comentario ?? null,
        datosAdicionales: datosAdicionales ?? null,
      });
      if (response.data.success) {
        toast.success(response.data.message ?? 'Acción registrada.');
        // Patrón RH: se cierra solo el formulario; la lista de acciones queda
        // abierta, refrescada con las acciones restantes de la matriz.
        await recargar();
        return true;
      }

      toast.error(response.data.message ?? 'No se pudo aplicar la acción');
      return false;
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo aplicar la acción');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const guardarCostos = async (idTaller: number, recursos: GuardarCostoRecursoRequest[]) => {
    if (idMatrizSeleccionada == null) return;
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.matricesTalleres.actualizarCostos(
        idMatrizSeleccionada,
        idTaller,
        { recursos }
      );
      if (response.data.success) {
        toast.success('Costos registrados.');
        setCostosTaller(null);
        await recargar();
      } else {
        toast.error(response.data.message ?? 'No se pudieron registrar los costos');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudieron registrar los costos');
    } finally {
      setGuardando(false);
    }
  };

  const abrirImpresion = async () => {
    if (idMatrizSeleccionada == null) return;
    setDocumento(null);
    setPrintOpen(true);
    try {
      const response = await educacionMedicaApi.matricesTalleres.documento(idMatrizSeleccionada);
      if (response.data.success) setDocumento(response.data.data ?? null);
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar el documento');
    }
  };

  const detalleTallerRef = useRef<number | null>(null);

  const abrirDetalleTaller = async (taller: Taller) => {
    detalleTallerRef.current = taller.idTaller;
    setDetalleTaller(taller);
    setUbicacionDetalle({ nombreRegion: taller.region });
    if (taller.idHospital == null) return;
    try {
      const response = await educacionMedicaApi.hospitales.getById(taller.idHospital);
      if (detalleTallerRef.current !== taller.idTaller) return;
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
  };

  const cerrarDetalleTaller = () => {
    detalleTallerRef.current = null;
    setDetalleTaller(null);
    setUbicacionDetalle(null);
  };

  // Reapertura selectiva de la captura de un equipo (GV, general en Creada).
  const reabrirCapturaEquipo = async () => {
    if (!equipoReabrir) return;
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.talleres.reabrirMatrizIndividual(
        equipoReabrir.idMatrizIndividual
      );
      if (response.data.success) {
        toast.success('Captura reabierta: el equipo puede volver a editar sus talleres.');
        setEquipoReabrir(null);
        await recargar();
      } else {
        toast.error(response.data.message ?? 'No se pudo reabrir la captura');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo reabrir la captura');
    } finally {
      setGuardando(false);
    }
  };

  const matriz = idMatrizSeleccionada == null ? null : detalle;
  const pasoActual = matriz?.pasoNombre ?? '';
  const puedeEditarCostos = pasoActual.toLowerCase().includes('costo');
  const documentoNombre = matriz
    ? `Matriz de talleres ${fmtPeriodo(matriz.periodo)} – ${matriz.gerencia ?? ''}`
    : 'Matriz de talleres';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo de gerencia</label>
          <Select
            value={idGerencia != null ? String(idGerencia) : ''}
            onValueChange={(v) => {
              setDetalle(null);
              setConcentracion([]);
              setLoadingMatrices(true);
              setLoadingDetalle(true);
              setIdGerencia(Number(v));
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Gerencia" />
            </SelectTrigger>
            <SelectContent>
              {gerencias.map((g) => (
                <SelectItem key={g.idTipoGerencia} value={String(g.idTipoGerencia)}>
                  {g.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mes</label>
          <Select
            value={String(mes)}
            onValueChange={(valor) => {
              setDetalle(null);
              setConcentracion([]);
              setLoadingMatrices(true);
              setLoadingDetalle(true);
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
              setDetalle(null);
              setConcentracion([]);
              setLoadingMatrices(true);
              setLoadingDetalle(true);
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

      {matrices.length === 0 && !loadingMatrices ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay matriz de talleres para esta gerencia y mes. Se crea automáticamente al capturar el
          primer taller del equipo.
        </p>
      ) : (
        <>
          {matriz && (
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
              showHistorial
              onHistorial={() => setHistorialOpen(true)}
              fondoClase="bg-emerald-50/60 dark:bg-emerald-950/20"
            />
          )}

          <div className="flex flex-wrap items-end gap-2">
            {matrices.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Matriz del mes</label>
                <Select
                  value={idMatrizSeleccionada != null ? String(idMatrizSeleccionada) : ''}
                  onValueChange={(v) => seleccionarMatriz(Number(v))}
                >
                  <SelectTrigger className="h-9 w-[280px]">
                    <SelectValue placeholder="Matriz" />
                  </SelectTrigger>
                  <SelectContent>
                    {matrices.map((m) => (
                      <SelectItem key={m.idMatrizGeneral} value={String(m.idMatrizGeneral)}>
                        {m.gerencia ?? `Gerencia ${m.idTipoGerencia}`} · {fmtPeriodo(m.periodo)} ·{' '}
                        {m.pasoNombre ?? '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {matriz && (
              <div className="ml-auto">
                <Button size="sm" variant="outline" onClick={() => void abrirImpresion()}>
                  <Printer className="mr-1.5 h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            )}
          </div>

          <Tabs
            value={vista}
            onValueChange={(valor) => setVista(valor as 'equipos' | 'hospitales')}
            className="w-full"
          >
            <TabsList className="grid h-12 w-full max-w-2xl grid-cols-2 border bg-background p-1">
              <TabsTrigger
                value="equipos"
                className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Por equipo
                <span className="group-data-[state=active]:bg-primary-foreground/20 ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:text-primary-foreground">
                  {concentracion.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="hospitales"
                className="border border-transparent text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Hospitales
                <span className="group-data-[state=active]:bg-primary-foreground/20 ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:text-primary-foreground">
                  {matriz?.totalTalleres ?? 0}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="equipos" className="mt-3">
              <MatrizEquiposTable
                equipos={concentracion}
                talleres={matriz?.talleres ?? []}
                loading={loadingDetalle}
                puedeReabrir={puedeReabrirCaptura && matriz?.esEditable === true}
                onReabrir={setEquipoReabrir}
                onVerDetalle={setEquipoDetalle}
              />
            </TabsContent>

            <TabsContent value="hospitales" className="mt-3">
              <MatrizTalleresTable
                talleres={matriz?.talleres ?? []}
                loading={loadingDetalle}
                puedeEditarCostos={puedeEditarCostos}
                onEditarCostos={setCostosTaller}
                onVerDetalle={(taller) => void abrirDetalleTaller(taller)}
                onMaterial={setMaterialTaller}
                onAsistencias={setAsistenciaTaller}
                onEvidencias={setEvidenciasTaller}
                onResolverSolicitud={setResolverTaller}
                onRefresh={() => void recargar()}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {matriz && (
        <>
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
        </>
      )}

      <MatrizCostosEditor
        open={costosTaller !== null}
        onClose={() => setCostosTaller(null)}
        taller={costosTaller}
        guardando={guardando}
        onGuardar={guardarCostos}
      />

      <AlertDialog
        open={equipoReabrir !== null}
        onOpenChange={(open) => {
          if (!open) setEquipoReabrir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir captura del equipo</AlertDialogTitle>
            <AlertDialogDescription>
              Se reabre la matriz individual de{' '}
              {equipoReabrir?.nombreEjecutivo ?? 'EV'} +{' '}
              {equipoReabrir?.nombreEspecialista ?? 'EP'}
              {equipoReabrir?.nombreRegion ? ` (${equipoReabrir.nombreRegion})` : ''}: el equipo
              podrá volver a editar sus talleres del mes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={guardando}
              onClick={(evento) => {
                evento.preventDefault();
                void reabrirCapturaEquipo();
              }}
            >
              {guardando ? 'Reabriendo...' : 'Reabrir captura'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TallerDetalleModal
        open={detalleTaller !== null}
        onClose={cerrarDetalleTaller}
        taller={detalleTaller}
        ubicacion={ubicacionDetalle}
      />

      <Modal
        id="modal-equipo-detalle"
        open={equipoDetalle !== null}
        setOpen={(open) => {
          if (!open) setEquipoDetalle(null);
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
          talleres={(matriz?.talleres ?? []).filter(
            (t) => t.idMatrizIndividual === equipoDetalle?.idMatrizIndividual
          )}
          loading={loadingDetalle}
          puedeEditarCostos={puedeEditarCostos}
          onEditarCostos={setCostosTaller}
          onVerDetalle={(taller) => void abrirDetalleTaller(taller)}
          onMaterial={setMaterialTaller}
          onAsistencias={setAsistenciaTaller}
          onEvidencias={setEvidenciasTaller}
          onResolverSolicitud={setResolverTaller}
        />
      </Modal>

      <MatrizPrintDocument open={printOpen} onOpenChange={setPrintOpen} documento={documento} />

      <TallerMaterialModal
        open={materialTaller !== null}
        onClose={() => setMaterialTaller(null)}
        taller={materialTaller}
        puedeGestionar={puedeGestionarMaterial}
        puedeConfirmar={puedeConfirmarMaterial}
        onChanged={() => void recargar()}
      />

      <TallerAsistenciaModal
        open={asistenciaTaller !== null}
        onClose={() => setAsistenciaTaller(null)}
        taller={asistenciaTaller}
        puedeCapturar={false}
        onChanged={() => void recargar()}
      />

      <TallerEvidenciasModal
        open={evidenciasTaller !== null}
        onClose={() => setEvidenciasTaller(null)}
        taller={evidenciasTaller}
        puedeGestionar={false}
        onChanged={() => void recargar()}
      />

      <ResolverSolicitudCambioModal
        open={resolverTaller !== null}
        onClose={() => setResolverTaller(null)}
        taller={resolverTaller}
        solicitud={resolverTaller?.solicitudCambioPendiente ?? null}
        onResolved={() => void recargar()}
      />
    </div>
  );
}
