import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileSignature, History, Printer, RefreshCcw } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
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
import { DocumentoFirmaModal } from '@/apps/educacion-medica/components/DocumentoFirmaModal';
import { DocumentoHistorialModal } from '@/apps/educacion-medica/components/DocumentoHistorialModal';
import { MatricesEquipoPanel } from './components/MatricesEquipoPanel';
import { MatrizTalleresTable } from './components/MatrizTalleresTable';
import { MatrizCostosEditor } from './components/MatrizCostosEditor';
import { MatrizPrintDocument } from './components/MatrizPrintDocument';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtPeriodo = (periodo: string) => periodo.slice(0, 7).split('-').reverse().join('/');

export default function MatrizTalleresPage() {
  usePageTitle('Matriz de talleres', 'Educación Médica');

  const { hasFirma } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [gerencias, setGerencias] = useState<TipoGerencia[]>([]);
  const [idGerencia, setIdGerencia] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7));

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
  ) => {
    if (idMatrizSeleccionada == null) return;
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.matricesTalleres.firmar(idMatrizSeleccionada, {
        idAccion: accion.idAccion,
        comentario: comentario ?? null,
        datosAdicionales: datosAdicionales ?? null,
      });
      if (response.data.success) {
        toast.success(response.data.message ?? 'Acción registrada.');
        setFirmaOpen(false);
        await recargar();
      } else {
        toast.error(response.data.message ?? 'No se pudo aplicar la acción');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo aplicar la acción');
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

  const matriz = idMatrizSeleccionada == null ? null : detalle;
  const pasoActual = matriz?.pasoNombre ?? '';
  const puedeEditarCostos = pasoActual.toLowerCase().includes('costo');
  const documentoNombre = matriz
    ? `Matriz de talleres ${fmtPeriodo(matriz.periodo)} – ${matriz.gerencia ?? ''}`
    : 'Matriz de talleres';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Matriz de talleres (FOR-005)</h1>
          <p className="text-sm text-muted-foreground">
            Concentrado mensual por gerencia. La firma del Gerente de Ventas inicia la cadena
            GV → costos AEM → revisión CA → autorización DC.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <input
            type="month"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={periodo}
            onChange={(e) => {
              setDetalle(null);
              setConcentracion([]);
              setLoadingMatrices(true);
              setLoadingDetalle(true);
              setPeriodo(e.target.value);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => void recargar()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {matrices.length === 0 && !loadingMatrices ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay matriz de talleres para esta gerencia y mes. Se crea automáticamente al capturar el
          primer taller del equipo.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
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
            {matriz && (
              <>
                <Badge variant="outline">{matriz.pasoNombre ?? '—'}</Badge>
                {matriz.estadoNombre && (
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: matriz.estadoColor ?? undefined,
                      color: matriz.estadoColor ?? undefined,
                    }}
                  >
                    {matriz.estadoNombre}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {matriz.totalTalleres} taller(es) · {fmtMoneda(matriz.costoTotal)}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setFirmaOpen(true)}
                    disabled={!matriz.acciones.length || guardando}
                  >
                    <FileSignature className="mr-1.5 h-4 w-4" />
                    Firmar / acciones
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setHistorialOpen(true)}>
                    <History className="mr-1.5 h-4 w-4" />
                    Historial
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void abrirImpresion()}>
                    <Printer className="mr-1.5 h-4 w-4" />
                    Imprimir
                  </Button>
                </div>
              </>
            )}
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Matrices por equipo</h2>
            <MatricesEquipoPanel equipos={concentracion} />
          </section>

          <MatrizTalleresTable
            talleres={matriz?.talleres ?? []}
            loading={loadingDetalle}
            puedeEditarCostos={puedeEditarCostos}
            onEditarCostos={setCostosTaller}
          />
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

      <MatrizPrintDocument open={printOpen} onOpenChange={setPrintOpen} documento={documento} />
    </div>
  );
}
