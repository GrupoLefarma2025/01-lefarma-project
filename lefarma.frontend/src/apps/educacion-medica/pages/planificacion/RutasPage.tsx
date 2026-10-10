import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { WorkflowAccionModal } from '@/components/workflows/WorkflowAccionModal';
import type { AccionWorkflow } from '@/components/workflows/workflowAccion';
import { DocumentoFirmaModal } from '@/apps/educacion-medica/components/DocumentoFirmaModal';
import { DocumentoHeaderCard } from '@/apps/educacion-medica/components/DocumentoHeaderCard';
import { DocumentoHistorialModal } from '@/apps/educacion-medica/components/DocumentoHistorialModal';
import { formatearPeriodoSeleccion } from '@/apps/educacion-medica/components/seleccionUtils';
import { useAuthStore } from '@/shared/auth/authStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  CalendarPlus,
  Gavel,
  GripVertical,
  History,
  Info,
  Loader2,
  MapPin,
  Plane,
  Printer,
  RefreshCcw,
  Route,
  Sparkles,
  Undo2,
  Users,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  AccionDisponible,
  EstrategiaReparto,
  HospitalUbicacion,
  Ruta,
  RutaVersionDto,
  RutaVisita,
  SeleccionDetalle,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { RutasHeader } from './components/RutasHeader';
import { RutasAlerts } from './components/RutasAlerts';
import { EquiposPanel, type ResumenEquipo } from './components/EquiposPanel';
import {
  SinPlanificarPanel,
  type HospitalSinPlanificar,
} from './components/SinPlanificarPanel';
import { SemanaRuta } from './components/SemanaRuta';
import { RutaDiaMapDialog } from './components/RutaDiaMapDialog';
import {
  RutasPrintModal,
  type EquipoImpresion,
  type EncabezadoImpresion,
} from './components/RutasPrintModal';
import { MotivoDialog } from './components/MotivoDialog';
import { VisitaExtraordinariaModal } from './components/VisitaExtraordinariaModal';
import { AjustesRutasModal } from './components/AjustesRutasModal';
import { HorasVisitaModal } from './components/HorasVisitaModal';
import {
  agruparPorDia,
  contarViajesForaneos,
  estadoDeVersion,
  formatearFecha,
  rangoSemanal,
  semanaIso,
  type DragPayload,
  type EstadoVersion,
} from './rutasUtils';

function diasLaborables(inicio: string, fin: string): string[] {
  const out: string[] = [];
  const d = new Date(`${inicio}T00:00:00`);
  const f = new Date(`${fin}T00:00:00`);
  while (d.getTime() <= f.getTime()) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${day}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function RutasPage() {
  usePageTitle('Planificación de rutas', 'Educación Médica');
  const navigate = useNavigate();
  const { idSeleccion } = useParams<{ idSeleccion: string }>();
  const idSeleccionMensual = Number(idSeleccion);

  const [seleccion, setSeleccion] = useState<SeleccionDetalle | null>(null);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [versionInfo, setVersionInfo] = useState<RutaVersionDto | null>(null);
  const [accionFirmaRutas, setAccionFirmaRutas] = useState<AccionDisponible | null>(null);
  const [modalFirma, setModalFirma] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const { hasFirma } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [avisosBackend, setAvisosBackend] = useState<string[]>([]);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<number | null>(null);
  const [busquedaEquipo, setBusquedaEquipo] = useState('');
  const [erroresAgregar, setErroresAgregar] = useState<Record<number, string>>({});
  const [editadoManual, setEditadoManual] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState('');
  const [modalRegenerar, setModalRegenerar] = useState(false);
  const [modalImprimir, setModalImprimir] = useState(false);
  const [equiposDict, setEquiposDict] = useState<Record<number, string>>({});
  const [mapaDia, setMapaDia] = useState<{
    fecha: string;
    hospitales: HospitalUbicacion[];
  } | null>(null);
  const [maxVisitasDia, setMaxVisitasDia] = useState(3);
  const [maxVisitasSemana, setMaxVisitasSemana] = useState(8);
  const [maxViajesForaneos, setMaxViajesForaneos] = useState(3);
  const [estrategia, setEstrategia] = useState<EstrategiaReparto>('ciudad');

  // Modo ajuste post-cierre (ADR-00010) y visita extraordinaria (ADR-00011)
  const puedeAjustar = usePermission({ require: 'educacion_medica.rutas.puede_ajustar' });
  const [modoAjuste, setModoAjuste] = useState(false);
  const [accionMotivo, setAccionMotivo] = useState<{
    titulo: string;
    descripcion?: string;
    ejecutar: (motivo: string) => Promise<void>;
  } | null>(null);
  const [extraordinariaOpen, setExtraordinariaOpen] = useState(false);
  const [ajustesOpen, setAjustesOpen] = useState(false);
  const [horasVisita, setHorasVisita] = useState<RutaVisita | null>(null);
  const [guardandoMotivo, setGuardandoMotivo] = useState(false);
  // dnd-kit (pointer events): sirve igual para mouse y tactil; el payload llega
  // via data del evento (sin carreras de estado) y el estado solo alimenta visuales.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const fetchTodo = useCallback(
    async (versionElegida?: number | null) => {
      if (!idSeleccionMensual) return;
      setLoading(true);
      try {
        const [detalleRes, rutasRes] = await Promise.all([
          educacionMedicaApi.seleccionesMensuales.getById(idSeleccionMensual),
          educacionMedicaApi.rutas.getBySeleccion(
            idSeleccionMensual,
            versionElegida ?? undefined
          ),
        ]);

        if (detalleRes.data.success) {
          setSeleccion(detalleRes.data.data ?? null);
        }

        if (rutasRes.data.success) {
          const lista = rutasRes.data.data ?? [];
          setRutas(lista);
          if (lista.length > 0) {
            setVersion(Math.max(...lista.map((r) => r.version)));
          }
        } else {
          toast.error(rutasRes.data.message ?? 'Error al cargar las rutas');
        }
      } catch (error: unknown) {
        toast.error(toApiError(error).message ?? 'Error al cargar las rutas');
      } finally {
        setLoading(false);
      }
    },
    [idSeleccionMensual]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; los setState ocurren tras el await
    fetchTodo(null);
  }, [fetchTodo]);

  // Estado de autorización de la versión activa (workflow GV → CA → DC, ADR-00006)
  useEffect(() => {
    if (!idSeleccionMensual || Number.isNaN(idSeleccionMensual) || version === null) return;

    let cancelado = false;
    educacionMedicaApi.rutas
      .version(idSeleccionMensual, version)
      .then((res) => {
        if (!cancelado && res.data.success) {
          setVersionInfo(res.data.data ?? null);
        }
      })
      .catch(() => {
        // Sin información de la versión; la vista cae al modo de solo lectura
      });

    return () => {
      cancelado = true;
    };
  }, [idSeleccionMensual, version, rutas]);

  useEffect(() => {
    educacionMedicaApi.parametrosModulo
      .getAll()
      .then((res) => {
        if (!res.data.success) return;
        const params = res.data.data ?? [];
        const leer = (clave: string) => params.find((p) => p.clave === clave)?.valor;
        if (leer('max_visitas_dia') !== undefined) setMaxVisitasDia(leer('max_visitas_dia')!);
        if (leer('max_visitas_semana') !== undefined) setMaxVisitasSemana(leer('max_visitas_semana')!);
        if (leer('max_viajes_foraneos_mes') !== undefined) setMaxViajesForaneos(leer('max_viajes_foraneos_mes')!);
      })
      .catch(() => {
        // Defaults 3/8/3 si no se pudieron cargar
      });

    educacionMedicaApi.equiposPareo
      .getAll()
      .then((res) => {
        if (!res.data.success) return;
        const dict: Record<number, string> = {};
        (res.data.data ?? []).forEach((e) => {
          dict[e.idEquipo] = `${e.nombreEjecutivo} + ${e.nombreEspecialista}`;
        });
        setEquiposDict(dict);
      })
      .catch(() => {
        // Sin nombres de integrantes: se muestra el nombre genérico de la ruta
      });
  }, []);

  const versionesInfo = useMemo(() => {
    const map = new Map<number, Ruta[]>();
    rutas.forEach((r) => map.set(r.version, [...(map.get(r.version) ?? []), r]));
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([v, rs]) => ({ version: v, estado: estadoDeVersion(rs) }));
  }, [rutas]);

  const rutasVisibles = useMemo(
    () => (version === null ? rutas : rutas.filter((r) => r.version === version)),
    [rutas, version]
  );

  const estadoVersion: EstadoVersion | null =
    versionesInfo.find((v) => v.version === version)?.estado ?? null;
  // Solo se usa la info de versión si corresponde a la versión seleccionada
  // (evita resetear estado dentro de un efecto al cambiar de versión)
  const versionInfoActual = versionInfo && versionInfo.version === version ? versionInfo : null;

  const editable =
    estadoVersion === 'Creada' &&
    seleccion?.estado === 'Cerrada' &&
    (versionInfoActual?.esEditable ?? true);
  // Modo ajuste (ADR-00010): versión Cerrada + permiso exclusivo del CEM.
  const ajusteDisponible = estadoVersion === 'Cerrada' && puedeAjustar;
  const ajusteActivo = ajusteDisponible && modoAjuste;
  const arrastrable = editable || ajusteActivo;
  const accionEnviarRutas =
    versionInfoActual?.acciones.find((a) => a.tipoAccionCodigo === 'ENVIAR') ?? null;
  const accionesFirmaRutas =
    versionInfoActual && !versionInfoActual.esEditable && !versionInfoActual.esFinal
      ? versionInfoActual.acciones.filter((a) => a.tipoAccionCodigo !== 'CANCELAR')
      : [];
  const hayDraft = rutasVisibles.some((r) => r.estado === 'Creada');

  const planificadasIds = useMemo(() => {
    const s = new Set<number>();
    rutasVisibles.forEach((r) =>
      r.visitas.forEach((v) => {
        // Las visitas extraordinarias no cubren hospitales de la selección (ADR-00011).
        if (v.idSeleccionHospital != null) s.add(v.idSeleccionHospital);
      })
    );
    return s;
  }, [rutasVisibles]);

  const regionesPorId = useMemo(
    () => new Map((seleccion?.regiones ?? []).map((z) => [z.idRegion, z])),
    [seleccion]
  );

  const gruposPorEquipo = useMemo(() => {
    const map = new Map<number, Ruta[]>();
    rutasVisibles.forEach((r) => map.set(r.idEquipo, [...(map.get(r.idEquipo) ?? []), r]));
    return map;
  }, [rutasVisibles]);

  const sinPlanificarPara = useCallback(
    (idEquipo: number): HospitalSinPlanificar[] => {
      if (!seleccion) return [];
      const items: HospitalSinPlanificar[] = [];
      for (const h of seleccion.hospitales) {
        if (planificadasIds.has(h.idSeleccionHospital)) continue;
        const region = h.idRegion != null ? regionesPorId.get(h.idRegion) : undefined;
        const sinAsignacion = !region || region.idEquipo == null;
        if (sinAsignacion || region!.idEquipo === idEquipo) {
          const partes = [h.ciudadMunicipio, h.entidadFederativa].filter(Boolean);
          items.push({
            idSeleccionHospital: h.idSeleccionHospital,
            nombre: h.nombreHospital ?? `Hospital ${h.idHospital}`,
            ubicacion: partes.length > 0 ? partes.join(', ') : null,
            regionNombre: region?.nombre ?? null,
            sinAsignacion,
          });
        }
      }
      return items.sort(
        (a, b) =>
          Number(a.sinAsignacion) - Number(b.sinAsignacion) || a.nombre.localeCompare(b.nombre)
      );
    },
    [seleccion, planificadasIds, regionesPorId]
  );

  const resumenEquipos: ResumenEquipo[] = useMemo(() => {
    return [...gruposPorEquipo.entries()]
      .map(([idEquipo, rs]) => {
        const visitas = rs.flatMap((r) => r.visitas);
        const porSemana = new Map<number, number>();
        visitas.forEach((v) => {
          const s = semanaIso(v.fechaVisita);
          porSemana.set(s, (porSemana.get(s) ?? 0) + 1);
        });
        const peor = [...porSemana.entries()].reduce<{ semana: number; carga: number } | null>(
          (acc, [semana, carga]) => (!acc || carga > acc.carga ? { semana, carga } : acc),
          null
        );
        const foraneos = contarViajesForaneos(visitas);
        const sinPlan = sinPlanificarPara(idEquipo).length;
        return {
          idEquipo,
          nombre: rs[0].nombreEquipo || `Equipo ${idEquipo}`,
          integrantes: equiposDict[idEquipo] ?? rs[0].nombreEquipo,
          totalVisitas: visitas.length,
          peorSemana: peor,
          foraneos,
          sinPlanificar: sinPlan,
          excede:
            foraneos > maxViajesForaneos ||
            (peor !== null && peor.carga > maxVisitasSemana) ||
            sinPlan > 0,
        };
      })
      .sort((a, b) => a.idEquipo - b.idEquipo);
  }, [gruposPorEquipo, equiposDict, maxViajesForaneos, maxVisitasSemana, sinPlanificarPara]);

  const equipoActivo = useMemo(
    () =>
      resumenEquipos.find((e) => e.idEquipo === equipoSeleccionado) ??
      resumenEquipos[0] ??
      null,
    [resumenEquipos, equipoSeleccionado]
  );

  const alertasAccion = useMemo(() => {
    if (!seleccion) return { cantidad: 0, nombres: [] as string[] };
    const sin = seleccion.hospitales.filter((h) => {
      if (planificadasIds.has(h.idSeleccionHospital)) return false;
      const region = h.idRegion != null ? regionesPorId.get(h.idRegion) : undefined;
      return !region || region.idEquipo == null;
    });
    return {
      cantidad: sin.length,
      nombres: sin.map((h) => h.nombreHospital ?? `Hospital ${h.idHospital}`),
    };
  }, [seleccion, planificadasIds, regionesPorId]);

  const advertenciasDerivadas = useMemo(
    () =>
      resumenEquipos
        .filter((e) => e.foraneos > maxViajesForaneos)
        .map(
          (e) =>
            `${e.nombre} supera el máximo mensual de viajes foráneos: ${e.foraneos}/${maxViajesForaneos}. Ajusta la distribución antes de confirmar.`
        ),
    [resumenEquipos, maxViajesForaneos]
  );

  const infoBanner = useMemo(() => {
    if (estadoVersion === 'Archivada') {
      return 'Versión archivada: solo lectura. Genera una propuesta nueva para editar.';
    }
    if (estadoVersion === 'Cancelada') {
      return 'Versión cancelada: solo lectura. Genera una propuesta nueva para retomar la calendarización.';
    }
    if (estadoVersion === 'Cerrada') {
      return puedeAjustar
        ? 'Rutas publicadas (documento cerrado). Activa «Modo ajuste» para corregir fecha, hora u orden: cada cambio exige motivo y queda auditado.'
        : 'Rutas publicadas. Para modificarlas usa «Solicitar cambio».';
    }
    if (seleccion && seleccion.estado !== 'Cerrada') {
      return 'La selección aún no está cerrada. El Gerente de Ventas debe cerrarla para poder planificar rutas.';
    }
    return null;
  }, [estadoVersion, seleccion, puedeAjustar]);

  const totalHospitales = seleccion?.hospitales.length ?? 0;
  const planificadas = planificadasIds.size;
  const sinPlanificarTotal = Math.max(0, totalHospitales - planificadas);
  const advertenciasTotales =
    alertasAccion.cantidad > 0 ? 1 + advertenciasDerivadas.length : advertenciasDerivadas.length;

  const generarInterno = async () => {
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.rutas.generar(idSeleccionMensual, estrategia);
      if (response.data.success && response.data.data) {
        setAvisosBackend(response.data.data.avisos);
        setEditadoManual(false);
        setErroresAgregar({});
        toast.success(
          `Propuesta v${response.data.data.version} generada · criterio: ${
            response.data.data.estrategia === 'centroide'
              ? 'compacto por distancia'
              : 'ciudades juntas'
          }.`
        );
        await fetchTodo(response.data.data.version);
      } else {
        toast.error(response.data.message ?? 'Error al generar la propuesta');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al generar la propuesta');
    } finally {
      setGuardando(false);
      setModalRegenerar(false);
    }
  };

  const onClickRegenerar = () => {
    if (editadoManual && hayDraft) {
      setModalRegenerar(true);
      return;
    }
    void generarInterno();
  };

  const firmarVersionRutas = async (
    accion: AccionWorkflow,
    comentario?: string,
    datosAdicionales?: Record<string, unknown> | null
  ): Promise<boolean> => {
    if (!versionInfoActual) return false;
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.rutas.firmarVersion(versionInfoActual.idRutaVersion, {
        idAccion: accion.idAccion,
        comentario: comentario ?? null,
        datosAdicionales: datosAdicionales ?? null,
      });

      if (response.data.success) {
        const confirmada = response.data.data?.estado === 'Cerrada';
        if (confirmada) {
          toast.success('Rutas confirmadas. Las asignaciones ya están publicadas.');
          setAvisosBackend([]);
        } else {
          toast.success('Acción registrada.');
        }
        // Cierra el modal de "Enviar a autorización" (acción suelta); la lista de
        // acciones del modal de firma queda abierta y se refresca (patrón RH).
        setAccionFirmaRutas(null);
        setEditadoManual(false);
        await fetchTodo();
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

  const abrirFirmaRutas = (accion: AccionDisponible) => {
    if (hasFirma === false) {
      toast.error('No tienes firma digital registrada. Cárgala en Configuración > Perfil.');
      return;
    }
    setAccionFirmaRutas(accion);
  };

  const cancelar = async () => {
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.rutas.cancelar(idSeleccionMensual, {
        motivo: motivoCancelar,
      });
      if (response.data.success) {
        toast.success('Rutas canceladas; ya puedes generar una nueva propuesta.');
        setModalCancelar(false);
        setMotivoCancelar('');
        await fetchTodo();
      } else {
        toast.error(response.data.message ?? 'Error al cancelar las rutas');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cancelar las rutas');
    } finally {
      setGuardando(false);
    }
  };

  const moverVisita = async (
    visita: RutaVisita,
    fechaDestino: string,
    orden: number,
    motivo?: string
  ) => {
    try {
      const response = await educacionMedicaApi.rutas.moverVisita(
        visita.idRuta,
        visita.idRutaVisita,
        { fechaVisita: fechaDestino, orden, motivo: motivo ?? null }
      );
      if (response.data.success) {
        toast.success('Visita movida.');
        const avisos = response.data.data?.avisos ?? [];
        if (avisos.length > 0) {
          setAvisosBackend(avisos);
          toast.warning(avisos[0]);
        }
        if (!ajusteActivo) setEditadoManual(true);
        await fetchTodo(version);
      } else {
        toast.error(response.data.message ?? 'No se pudo mover la visita');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo mover la visita');
    }
  };

  const quitarVisita = async (visita: RutaVisita, motivo?: string) => {
    try {
      const response = await educacionMedicaApi.rutas.quitarVisita(
        visita.idRuta,
        visita.idRutaVisita,
        motivo ?? null
      );
      if (response.data.success) {
        toast.success(
          ajusteActivo
            ? 'Visita quitada (ajuste auditado).'
            : 'El hospital volvió a Sin planificar (sigue en la selección).'
        );
        if (!ajusteActivo) setEditadoManual(true);
        await fetchTodo(version);
      } else {
        toast.error(response.data.message ?? 'No se pudo quitar la visita');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo quitar la visita');
    }
  };

  /** En modo ajuste toda acción pasa por el diálogo de motivo (ADR-00010). */
  const solicitarMotivo = (
    titulo: string,
    descripcion: string,
    ejecutar: (motivo: string) => Promise<void>
  ) => {
    setAccionMotivo({ titulo, descripcion, ejecutar });
  };

  const guardarHorasVisita = async (
    horas: { horaSalida: string | null; horaLlegada: string | null },
    motivo?: string
  ) => {
    if (!horasVisita) return;
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.rutas.editarHoras(
        horasVisita.idRuta,
        horasVisita.idRutaVisita,
        { ...horas, motivo: motivo ?? null }
      );
      if (response.data.success) {
        toast.success('Horas de la visita actualizadas.');
        setHorasVisita(null);
        await fetchTodo(version);
      } else {
        toast.error(response.data.message ?? 'No se pudieron actualizar las horas');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudieron actualizar las horas');
    } finally {
      setGuardando(false);
    }
  };

  const handleDropEnDia = async (ruta: Ruta, fecha: string, payload: DragPayload) => {
    if (!arrastrable) return;

    if (payload.tipo === 'visita' && payload.visita.idRuta !== ruta.idRuta) {
      toast.error(
        'Esa visita pertenece a otra ruta del equipo (zona dividida); muévela dentro de su propia ruta.'
      );
      return;
    }

    // Tope duro en cliente (espejo de ValidarMovimientoAsync del backend): evita
    // la llamada que terminaria rechazada y explica el motivo al instante.
    // En modo ajuste la capacidad avisa (no bloquea): decide el backend (ADR-00010).
    const esReordenMismoDia =
      payload.tipo === 'visita' && payload.visita.fechaVisita === fecha;
    if (!esReordenMismoDia && !ajusteActivo) {
      const delDia = ruta.visitas.filter((v) => v.fechaVisita === fecha).length;
      if (delDia >= maxVisitasDia) {
        toast.error(
          `El día ${formatearFecha(fecha)} ya alcanzó el máximo de ${maxVisitasDia} visitas.`
        );
        return;
      }
      const mismaSemana = (f: string) =>
        f.slice(0, 4) === fecha.slice(0, 4) && semanaIso(f) === semanaIso(fecha);
      const deLaSemana = ruta.visitas.filter((v) => mismaSemana(v.fechaVisita)).length;
      const saleDeLaSemana =
        payload.tipo === 'visita' && mismaSemana(payload.visita.fechaVisita) ? 1 : 0;
      if (deLaSemana - saleDeLaSemana >= maxVisitasSemana) {
        toast.error(
          `La semana ${semanaIso(fecha)} ya alcanzó el máximo de ${maxVisitasSemana} visitas.`
        );
        return;
      }
    }

    const orden = ruta.visitas.filter((v) => v.fechaVisita === fecha).length + 1;

    if (payload.tipo === 'nuevo') {
      const idSeleccionHospital = payload.idSeleccionHospital;
      const agregar = async (motivo?: string) => {
        setGuardando(true);
        try {
          const res = await educacionMedicaApi.rutas.agregarVisita(ruta.idRuta, {
            idSeleccionHospital,
            fechaVisita: fecha,
            orden,
            motivo: motivo ?? null,
          });
          if (res.data.success) {
            const aviso = res.data.data?.aviso;
            const avisos = res.data.data?.avisos ?? [];
            if (aviso) toast.warning(aviso);
            else toast.success('Visita agregada.');
            if (avisos.length > 0) {
              setAvisosBackend(avisos);
              toast.warning(avisos[0]);
            }
            setErroresAgregar((prev) => {
              const next = { ...prev };
              delete next[idSeleccionHospital];
              return next;
            });
            if (!ajusteActivo) setEditadoManual(true);
            await fetchTodo(version);
          } else {
            const msg = res.data.message ?? 'No se pudo agregar la visita';
            setErroresAgregar((prev) => ({ ...prev, [idSeleccionHospital]: msg }));
            toast.error(msg);
          }
        } catch (error: unknown) {
          const msg = toApiError(error).message ?? 'No se pudo agregar la visita';
          setErroresAgregar((prev) => ({ ...prev, [idSeleccionHospital]: msg }));
          toast.error(msg);
        } finally {
          setGuardando(false);
        }
      };

      if (ajusteActivo) {
        solicitarMotivo(
          'Agregar visita (ajuste post-cierre)',
          `El hospital se agrega el ${formatearFecha(fecha)} con motivo auditado.`,
          agregar
        );
      } else {
        await agregar();
      }
      return;
    }

    if (ajusteActivo) {
      solicitarMotivo(
        'Mover visita (ajuste post-cierre)',
        `La visita se mueve al ${formatearFecha(fecha)} (posición ${orden}) con motivo auditado. Si la ruta no tiene cupo, el backend avisará.`,
        (motivo) => moverVisita(payload.visita, fecha, orden, motivo)
      );
      return;
    }

    await moverVisita(payload.visita, fecha, orden);
  };

  const handleDndStart = (event: DragStartEvent) => {
    setDragPayload((event.active.data.current as DragPayload | undefined) ?? null);
  };

  const handleDndEnd = (event: DragEndEvent) => {
    setDragPayload(null);
    const payload = event.active.data.current as DragPayload | undefined;
    const over = event.over;
    if (!arrastrable || !payload || !over) return;
    if (over.id === 'sin-planificar') {
      if (payload.tipo === 'visita') {
        const visita = payload.visita;
        if (ajusteActivo) {
          solicitarMotivo(
            'Quitar visita (ajuste post-cierre)',
            'La visita se da de baja de la ruta con motivo auditado.',
            (motivo) => quitarVisita(visita, motivo)
          );
        } else {
          void quitarVisita(visita);
        }
      }
      return;
    }
    const dia = over.data.current as { fecha: string; idRuta: number } | undefined;
    if (!dia) return;
    const ruta = rutasVisibles.find((r) => r.idRuta === dia.idRuta);
    if (!ruta) return;
    void handleDropEnDia(ruta, dia.fecha, payload);
  };

  const handleDndCancel = () => setDragPayload(null);

  const ubicacionPorVisita = useCallback(
    (visita: RutaVisita): string | null => {
      const h = seleccion?.hospitales.find((x) => x.idSeleccionHospital === visita.idSeleccionHospital);
      if (!h) return null;
      const partes = [h.ciudadMunicipio, h.entidadFederativa].filter(Boolean);
      return partes.length > 0 ? partes.join(', ') : null;
    },
    [seleccion]
  );

  const overlayNombre =
    dragPayload?.tipo === 'visita'
      ? (dragPayload.visita.nombreHospital ??
        `Hospital ${dragPayload.visita.idHospital ?? dragPayload.visita.idSeleccionHospital}`)
      : dragPayload?.tipo === 'nuevo'
        ? dragPayload.nombre
        : null;
  const overlayUbicacion =
    dragPayload?.tipo === 'visita' ? ubicacionPorVisita(dragPayload.visita) : null;

  const abrirMapaDia = useCallback(
    (fecha: string, visitas: RutaVisita[]) => {
      const dict = new Map((seleccion?.hospitales ?? []).map((h) => [h.idSeleccionHospital, h]));
      const ubicaciones: HospitalUbicacion[] = visitas.flatMap((v) => {
        const h = v.idSeleccionHospital != null ? dict.get(v.idSeleccionHospital) : undefined;
        if (!h || h.latitudSnapshot == null || h.longitudSnapshot == null) return [];
        return [
          {
            codigoContacto: h.idHospital ?? h.idSeleccionHospital,
            nombreContacto: h.nombreHospital ?? `Hospital ${h.idHospital}`,
            nombreCorto: null,
            clues: null,
            ciudad: h.ciudadMunicipio,
            codigoEstado: null,
            latitud: h.latitudSnapshot,
            longitud: h.longitudSnapshot,
            idRegion: h.idRegion,
            regionNombre: h.nombreRegion,
          },
        ];
      });
      setMapaDia({ fecha, hospitales: ubicaciones });
    },
    [seleccion]
  );

  const rangoSemanas = useMemo(() => {
    let inicio = seleccion?.fechaInicioVigencia ?? null;
    let fin = seleccion?.fechaFinVigencia ?? null;
    if (!inicio || !fin) {
      const fechas = rutasVisibles
        .flatMap((r) => r.visitas.map((v) => v.fechaVisita))
        .sort();
      if (fechas.length === 0) return [];
      inicio = fechas[0];
      fin = fechas[fechas.length - 1];
    }
    const dias = diasLaborables(inicio, fin);
    const semanas = new Map<number, string[]>();
    dias.forEach((fecha) => {
      const s = semanaIso(fecha);
      semanas.set(s, [...(semanas.get(s) ?? []), fecha]);
    });
    return [...semanas.entries()];
  }, [seleccion, rutasVisibles]);

  const construirSemanas = useCallback(
    (ruta: Ruta) => {
      const visitasPorFecha = new Map<string, RutaVisita[]>();
      ruta.visitas.forEach((v) => {
        const lista = visitasPorFecha.get(v.fechaVisita) ?? [];
        lista.push(v);
        visitasPorFecha.set(v.fechaVisita, lista);
      });
      const base =
        rangoSemanas.length > 0
          ? rangoSemanas
          : ([...visitasPorFecha.keys()].sort().map((f) => [semanaIso(f), [f]] as [number, string[]]));
      return base
        .map(([semana, dias]) => ({
          semana,
          dias: dias.map((fecha) => ({
            fecha,
            visitas: [...(visitasPorFecha.get(fecha) ?? [])].sort((a, b) => a.orden - b.orden),
          })),
        }))
        .filter(
          ({ dias }) =>
            dias.some((d) => d.visitas.length > 0) ||
            dias.length > 0
        );
    },
    [rangoSemanas]
  );

  const equiposImpresion = useMemo<EquipoImpresion[]>(() => {
    return resumenEquipos.map((eq) => {
      const rutasEquipo = gruposPorEquipo.get(eq.idEquipo) ?? [];
      const visitas = rutasEquipo.flatMap((r) => r.visitas);
      const semanasMap = new Map<number, { fecha: string; visitas: RutaVisita[] }[]>();
      for (const d of agruparPorDia(visitas)) {
        const s = semanaIso(d.fecha);
        semanasMap.set(s, [...(semanasMap.get(s) ?? []), d]);
      }
      const semanas: EquipoImpresion['semanas'] = [...semanasMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([semana, diasSemana]) => ({
          semana,
          rango: rangoSemanal(diasSemana.map((d) => d.fecha)),
          totalVisitas: diasSemana.reduce((acc, d) => acc + d.visitas.length, 0),
          dias: diasSemana.map((d) => ({
            fecha: d.fecha,
            visitas: d.visitas.map((v) => ({
              orden: v.orden,
              hospital:
                v.nombreHospital ?? `Hospital ${v.idHospital ?? v.idSeleccionHospital}`,
              ubicacion: ubicacionPorVisita(v) ?? '',
              foranea: v.esForanea,
            })),
          })),
        }));
      return {
        idEquipo: eq.idEquipo,
        nombre: eq.nombre,
        integrantes: eq.integrantes,
        semanas,
        totalVisitas: eq.totalVisitas,
        foraneos: eq.foraneos,
        maxViajesForaneos,
        maxVisitasSemana,
        sinPlanificar: sinPlanificarPara(eq.idEquipo)
          .filter((h) => !h.sinAsignacion)
          .map((h) => h.nombre),
      };
    });
  }, [
    resumenEquipos,
    gruposPorEquipo,
    ubicacionPorVisita,
    sinPlanificarPara,
    maxViajesForaneos,
    maxVisitasSemana,
  ]);

  const encabezadoImpresion = useMemo<EncabezadoImpresion>(
    () => ({
      gerencia: seleccion?.tipoGerencia ?? null,
      vigencia:
        seleccion?.fechaInicioVigencia && seleccion?.fechaFinVigencia
          ? `${formatearFecha(seleccion.fechaInicioVigencia)} – ${formatearFecha(seleccion.fechaFinVigencia)}`
          : '—',
      fechaSeleccion: seleccion ? formatearFecha(seleccion.fechaSeleccion) : '—',
      version,
      estadoVersion,
      totalHospitales,
    }),
    [seleccion, version, estadoVersion, totalHospitales]
  );

  if (!idSeleccionMensual || Number.isNaN(idSeleccionMensual)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Selecciona primero una selección mensual.</p>
        <Button variant="outline" onClick={() => navigate('/educacion-medica/seleccion')}>
          Ir a Selección Mensual
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RutasHeader
        versiones={versionesInfo}
        version={version}
        onVersionChange={(v) => {
          setVersion(v);
          setEquipoSeleccionado(null);
          setErroresAgregar({});
        }}
        onBack={() => navigate('/educacion-medica/seleccion')}
      />

      {versionInfoActual && (
        <DocumentoHeaderCard
          titulo={`Rutas v${versionInfoActual.version}`}
          pasoNombre={versionInfoActual.pasoNombre}
          estadoNombre={versionInfoActual.estadoNombre}
          estadoColor={versionInfoActual.estadoColor}
          estadoFallback={versionInfoActual.estado ?? estadoVersion}
          detalle={
            seleccion
              ? `${seleccion.tipoGerencia ?? 'Sin gerencia'} · Selección ${formatearPeriodoSeleccion(seleccion.fechaSeleccion)}`
              : undefined
          }
          showFirmar={accionesFirmaRutas.length > 0}
          onFirmar={() => setModalFirma(true)}
          firmando={guardando}
          firmarDeshabilitado={hasFirma === false}
          showHistorial
          onHistorial={() => setModalHistorial(true)}
        />
      )}

      {/* Modo ajuste post-cierre (ADR-00010): permiso exclusivo del CEM en versión Cerrada */}
      {ajusteDisponible && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-950/30">
          <Switch
            id="switch-modo-ajuste"
            checked={modoAjuste}
            onCheckedChange={(valor) => {
              setModoAjuste(valor);
              if (!valor) setAvisosBackend([]);
            }}
          />
          <label htmlFor="switch-modo-ajuste" className="text-sm font-medium">
            Modo ajuste
          </label>
          <span className="text-xs text-muted-foreground">
            Documento cerrado: los cambios (fecha, hora, orden, altas/bajas) exigen motivo y quedan
            auditados; la capacidad avisa pero no bloquea.
          </span>
          <div className="flex-1" />
          {ajusteActivo && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="bg-card"
                onClick={() => setExtraordinariaOpen(true)}
              >
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                Visita extraordinaria
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-card"
                onClick={() => setAjustesOpen(true)}
                disabled={versionInfoActual == null}
              >
                <History className="mr-1.5 h-4 w-4" />
                Ajustes
              </Button>
            </>
          )}
        </div>
      )}

      {!loading && rutasVisibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-lg border bg-card px-4 py-2.5 shadow-sm">
          <span className="inline-flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold tabular-nums">{resumenEquipos.length}</span>
            <span className="text-muted-foreground">
              {resumenEquipos.length === 1 ? 'equipo' : 'equipos'}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold tabular-nums">
              {planificadas}/{totalHospitales}
            </span>
            <span className="text-muted-foreground">planificadas</span>
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-2 text-sm',
              sinPlanificarTotal > 0 && 'text-amber-600 dark:text-amber-400'
            )}
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <span className="font-semibold tabular-nums">{sinPlanificarTotal}</span>
            <span className={sinPlanificarTotal > 0 ? undefined : 'text-muted-foreground'}>
              sin planificar
            </span>
          </span>
          {advertenciasTotales > 0 && (
            <span className="inline-flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span className="font-semibold tabular-nums">{advertenciasTotales}</span>
              <span>advertencias</span>
            </span>
          )}
        </div>
      )}

      {(seleccion?.estado === 'Cerrada' || rutasVisibles.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 bg-card"
            onClick={() => fetchTodo(version)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Actualizar
          </Button>
          {rutasVisibles.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-card"
              onClick={() => setModalImprimir(true)}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          )}
          {seleccion?.estado === 'Cerrada' && estadoVersion !== 'Cerrada' && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-100 py-1 pl-3 pr-1 dark:border-slate-700 dark:bg-slate-800/60">
              <span className="text-xs font-medium text-muted-foreground">
                Criterio de reparto
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label="Cómo funciona el criterio de reparto"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Cómo reparte el sistema las visitas al generar la propuesta. Siempre es una
                    sugerencia: puedes mover visitas después.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Select
                value={estrategia}
                onValueChange={(v) => setEstrategia(v as EstrategiaReparto)}
              >
                <SelectTrigger
                  className="h-7 w-[210px] bg-card text-xs"
                  aria-label="Criterio de reparto"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ciudad">Ciudades juntas (una ciudad por día)</SelectItem>
                  <SelectItem value="centroide">Compacto (por distancia al centroide)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 bg-card"
                disabled={guardando}
                onClick={onClickRegenerar}
              >
                {guardando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {hayDraft ? 'Regenerar propuesta' : 'Generar propuesta'}
              </Button>
            </div>
          )}
          {seleccion?.estado === 'Cerrada' && estadoVersion === 'Cerrada' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-card"
              onClick={() => setModalCancelar(true)}
            >
              <Undo2 className="h-4 w-4" />
              Solicitar cambio
            </Button>
          )}
          {accionEnviarRutas && (
            <Button
              size="sm"
              disabled={guardando}
              onClick={() => abrirFirmaRutas(accionEnviarRutas)}
              className="gap-1.5 font-semibold"
            >
              <Gavel className="h-4 w-4" />
              Enviar a autorización
            </Button>
          )}
        </div>
      )}

      <RutasAlerts
        sinAsignacion={alertasAccion}
        onIrASeleccion={() => navigate('/educacion-medica/seleccion')}
        advertencias={advertenciasDerivadas}
        avisosBackend={avisosBackend}
        info={infoBanner}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rutasVisibles.length === 0 ? (
        <div className="rounded-lg border bg-card shadow-sm">
          <EmptyState
            icon={<Route className="h-10 w-10" />}
            title={
              seleccion?.estado === 'Cerrada'
                ? 'Sin propuesta de rutas'
                : 'Esta selección aún no tiene rutas'
            }
            className="py-10"
          />
          <p className="mx-auto -mt-3 max-w-md px-6 text-center text-sm text-muted-foreground">
            {seleccion?.estado === 'Cerrada'
              ? `La selección está autorizada con ${totalHospitales} hospital${
                  totalHospitales === 1 ? '' : 'es'
                }. Genera la propuesta inicial para calendarizar las visitas.`
              : 'Autoriza la selección (doble firma GV + GG) en el paso Autorización para poder planificar rutas.'}
          </p>
          <div className="flex justify-center pb-8 pt-4">
            {seleccion?.estado === 'Cerrada' ? (
              <Button disabled={guardando} onClick={onClickRegenerar} className="gap-1.5">
                {guardando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generar propuesta
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate('/educacion-medica/seleccion')}>
                Ir a Selección Mensual
              </Button>
            )}
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDndStart}
          onDragEnd={handleDndEnd}
          onDragCancel={handleDndCancel}
        >
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <EquiposPanel
              equipos={resumenEquipos}
              seleccionado={equipoActivo?.idEquipo ?? null}
              onSelect={setEquipoSeleccionado}
              busqueda={busquedaEquipo}
              onBusquedaChange={setBusquedaEquipo}
              maxVisitasSemana={maxVisitasSemana}
              maxViajesForaneos={maxViajesForaneos}
            />

            {equipoActivo && (
              <div className="min-w-0 space-y-4">
              <div className="rounded-lg border bg-card px-3 py-2 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-sm font-semibold">{equipoActivo.nombre}</p>
                  <span className="text-xs text-muted-foreground">{equipoActivo.integrantes}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-semibold tabular-nums text-foreground">
                      {equipoActivo.totalVisitas}
                    </span>
                    planificadas
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      equipoActivo.sinPlanificar > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-semibold tabular-nums">{equipoActivo.sinPlanificar}</span>
                    sin planificar
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      equipoActivo.foraneos > maxViajesForaneos
                        ? 'font-semibold text-destructive'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Plane className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-semibold tabular-nums">
                      {equipoActivo.foraneos}/{maxViajesForaneos}
                    </span>
                    viajes foráneos
                    {equipoActivo.foraneos > maxViajesForaneos && (
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </span>
                </div>
              </div>

              <SinPlanificarPanel
                items={sinPlanificarPara(equipoActivo.idEquipo)}
                errores={erroresAgregar}
                editable={arrastrable}
                dragActivo={dragPayload}
              />

              {(gruposPorEquipo.get(equipoActivo.idEquipo) ?? []).map((ruta) => {
                const semanas = construirSemanas(ruta);
                const multiple = (gruposPorEquipo.get(equipoActivo.idEquipo) ?? []).length > 1;
                return (
                  <div key={ruta.idRuta} className="space-y-3">
                    {multiple && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {ruta.nombre ?? `Ruta ${ruta.idRuta}`} · {ruta.estado}
                      </p>
                    )}
                    {semanas.map(({ semana, dias }) => (
                      <SemanaRuta
                        key={`${ruta.idRuta}-${semana}`}
                        idRuta={ruta.idRuta}
                        semana={semana}
                        dias={dias}
                        maxVisitasDia={maxVisitasDia}
                        maxVisitasSemana={maxVisitasSemana}
                        editable={arrastrable}
                        modoAjuste={ajusteActivo}
                        dragActivo={dragPayload}
                        ubicacionPorVisita={ubicacionPorVisita}
                        onRetornar={(visita) => {
                          if (ajusteActivo) {
                            solicitarMotivo(
                              'Quitar visita (ajuste post-cierre)',
                              'La visita se da de baja de la ruta con motivo auditado (BAJA_VISITA).',
                              (motivo) => quitarVisita(visita, motivo)
                            );
                          } else {
                            void quitarVisita(visita);
                          }
                        }}
                        onVerMapa={abrirMapaDia}
                        onEditarHoras={(visita) => setHorasVisita(visita)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            )}
          </div>

          <DragOverlay dropAnimation={null}>
            {dragPayload && overlayNombre ? (
              <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm shadow-lg ring-1 ring-blue-300 dark:ring-blue-800">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{overlayNombre}</div>
                  {overlayUbicacion && (
                    <p className="truncate text-xs text-muted-foreground">{overlayUbicacion}</p>
                  )}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <RutaDiaMapDialog
        open={mapaDia !== null}
        onOpenChange={(open) => {
          if (!open) setMapaDia(null);
        }}
        titulo={`Recorrido del día ${mapaDia?.fecha ?? ''}`}
        subtitulo="Valida que el orden de las visitas tenga sentido geográfico."
        hospitales={mapaDia?.hospitales ?? []}
      />

      <RutasPrintModal
        open={modalImprimir}
        onOpenChange={setModalImprimir}
        encabezado={encabezadoImpresion}
        equipos={equiposImpresion}
      />

      <Modal
        id="modal-regenerar-rutas"
        open={modalRegenerar}
        setOpen={setModalRegenerar}
        title="Regenerar propuesta con ajustes manuales"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalRegenerar(false)}>
              Volver
            </Button>
            <Button variant="destructive" onClick={() => void generarInterno()} disabled={guardando}>
              Regenerar de todos modos
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Esta versión tiene ajustes manuales (movimientos, altas o bajas). Al regenerar, el
          borrador actual pasará a <strong>Archivada</strong> y se creará una versión nueva desde
          cero; el trabajo manual no se conserva (queda consultable en la versión archivada).
        </p>
      </Modal>

      <Modal
        id="modal-cancelar-rutas"
        open={modalCancelar}
        setOpen={setModalCancelar}
        title="Cancelar rutas confirmadas"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalCancelar(false)}>
              Volver
            </Button>
            <Button variant="destructive" onClick={cancelar} disabled={motivoCancelar.trim().length < 5}>
              Cancelar rutas
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Las rutas confirmadas pasarán a Cancelada y podrás generar una nueva propuesta. Queda
            huella por versiones.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-cancelar-rutas">Motivo del cambio</Label>
            <Input
              id="motivo-cancelar-rutas"
              placeholder="Describe brevemente el motivo..."
              value={motivoCancelar}
              onChange={(e) => setMotivoCancelar(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {versionInfoActual && (
        <DocumentoFirmaModal
          open={modalFirma}
          onClose={() => setModalFirma(false)}
          documento={`Rutas v${versionInfoActual.version}`}
          estadoTexto={
            versionInfoActual.estadoNombre ??
            (versionInfoActual.estado || 'Sin estado')
          }
          pasoNombre={versionInfoActual.pasoNombre}
          tipo="rutas"
          idEntidad={versionInfoActual.idRutaVersion}
          idPasoActual={versionInfoActual.idPasoActual}
          acciones={accionesFirmaRutas}
          hasFirma={hasFirma ?? undefined}
          guardando={guardando}
          onConfirmar={(accion, comentario, datosAdicionales) =>
            firmarVersionRutas(accion, comentario, datosAdicionales)
          }
        />
      )}

      {versionInfoActual && (
        <DocumentoHistorialModal
          open={modalHistorial}
          onClose={() => setModalHistorial(false)}
          documento={`Rutas v${versionInfoActual.version}`}
          estadoTexto={versionInfoActual.estadoNombre ?? versionInfoActual.estado ?? 'Sin estado'}
          tipo="rutas"
          idEntidad={versionInfoActual.idRutaVersion}
          idWorkflow={versionInfoActual.idWorkflow}
          idPasoActual={versionInfoActual.idPasoActual}
        />
      )}

      <WorkflowAccionModal
        open={accionFirmaRutas !== null}
        onClose={() => setAccionFirmaRutas(null)}
        accion={accionFirmaRutas}
        tituloEntidad={versionInfoActual ? `Rutas v${versionInfoActual.version}` : null}
        hasFirma={hasFirma ?? undefined}
        guardando={guardando}
        entidadTipo="RutaVersion"
        entidadId={versionInfoActual?.idRutaVersion}
        carpetaAdjuntos="educacion-medica-rutas"
        idPasoActual={versionInfoActual?.idPasoActual}
        onConfirmar={(comentario, datosAdicionales) => {
          if (accionFirmaRutas) void firmarVersionRutas(accionFirmaRutas, comentario, datosAdicionales);
        }}
      />

      {/* Modo ajuste post-cierre (ADR-00010) y visita extraordinaria (ADR-00011) */}
      <MotivoDialog
        open={accionMotivo !== null}
        onClose={() => setAccionMotivo(null)}
        titulo={accionMotivo?.titulo ?? ''}
        descripcion={accionMotivo?.descripcion}
        guardando={guardandoMotivo}
        onConfirmar={async (motivo) => {
          if (!accionMotivo) return;
          setGuardandoMotivo(true);
          try {
            await accionMotivo.ejecutar(motivo);
            setAccionMotivo(null);
          } finally {
            setGuardandoMotivo(false);
          }
        }}
      />

      <VisitaExtraordinariaModal
        open={extraordinariaOpen}
        onClose={() => setExtraordinariaOpen(false)}
        idSeleccionMensual={idSeleccionMensual}
        onCreated={(avisos) => {
          if (avisos.length > 0) setAvisosBackend(avisos);
          void fetchTodo(version);
        }}
      />

      <AjustesRutasModal
        open={ajustesOpen}
        onClose={() => setAjustesOpen(false)}
        idRutaVersion={versionInfoActual?.idRutaVersion ?? null}
        version={version}
      />

      <HorasVisitaModal
        open={horasVisita !== null}
        onClose={() => setHorasVisita(null)}
        visita={horasVisita}
        requiereMotivo={ajusteActivo}
        guardando={guardando}
        onGuardar={(horas, motivo) => guardarHorasVisita(horas, motivo)}
      />
    </div>
  );
}
