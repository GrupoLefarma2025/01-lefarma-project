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
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Gavel, GripVertical, Loader2, Printer, RefreshCcw, Sparkles, Undo2 } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  EstrategiaReparto,
  HospitalUbicacion,
  Ruta,
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
    fetchTodo(null);
  }, [fetchTodo]);

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
  const editable = estadoVersion === 'Draft' && seleccion?.estado === 'Autorizada';
  const hayDraft = rutasVisibles.some((r) => r.estado === 'Draft');

  const planificadasIds = useMemo(() => {
    const s = new Set<number>();
    rutasVisibles.forEach((r) => r.visitas.forEach((v) => s.add(v.idSeleccionHospital)));
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
      return 'Estás viendo una versión archivada. Es de solo lectura; genera una propuesta nueva para editar.';
    }
    if (estadoVersion === 'Cancelada') {
      return 'Esta versión fue cancelada (solo lectura). Genera una propuesta nueva para retomar la calendarización.';
    }
    if (estadoVersion === 'Confirmada') {
      return 'Rutas confirmadas y publicadas. Para modificarlas usa "Solicitar cambio" (cancelar → regenerar → confirmar).';
    }
    if (seleccion && seleccion.estado !== 'Autorizada' && seleccion.estado !== 'Cerrada') {
      return 'La selección aún no está autorizada; autorízala en el paso Autorización para poder confirmar rutas.';
    }
    return null;
  }, [estadoVersion, seleccion]);

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

  const confirmar = async () => {
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.rutas.confirmar(idSeleccionMensual);
      if (response.data.success) {
        toast.success('Rutas confirmadas. Las asignaciones ya están publicadas.');
        setAvisosBackend([]);
        setEditadoManual(false);
        await fetchTodo();
      } else {
        toast.error(response.data.message ?? 'Error al confirmar las rutas');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al confirmar las rutas');
    } finally {
      setGuardando(false);
    }
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

  const moverVisita = async (visita: RutaVisita, fechaDestino: string, orden: number) => {
    try {
      const response = await educacionMedicaApi.rutas.moverVisita(
        visita.idRuta,
        visita.idRutaVisita,
        { fechaVisita: fechaDestino, orden }
      );
      if (response.data.success) {
        toast.success('Visita movida.');
        setEditadoManual(true);
        await fetchTodo(version);
      } else {
        toast.error(response.data.message ?? 'No se pudo mover la visita');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo mover la visita');
    }
  };

  const quitarVisita = async (visita: RutaVisita) => {
    try {
      const response = await educacionMedicaApi.rutas.quitarVisita(visita.idRuta, visita.idRutaVisita);
      if (response.data.success) {
        toast.success('El hospital volvió a Sin planificar (sigue en la selección).');
        setEditadoManual(true);
        await fetchTodo(version);
      } else {
        toast.error(response.data.message ?? 'No se pudo quitar la visita');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo quitar la visita');
    }
  };

  const handleDropEnDia = async (ruta: Ruta, fecha: string, payload: DragPayload) => {
    if (!editable) return;

    if (payload.tipo === 'visita' && payload.visita.idRuta !== ruta.idRuta) {
      toast.error(
        'Esa visita pertenece a otra ruta del equipo (zona dividida); muévela dentro de su propia ruta.'
      );
      return;
    }

    // Tope duro en cliente (espejo de ValidarMovimientoAsync del backend): evita
    // la llamada que terminaria rechazada y explica el motivo al instante.
    const esReordenMismoDia =
      payload.tipo === 'visita' && payload.visita.fechaVisita === fecha;
    if (!esReordenMismoDia) {
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
      setGuardando(true);
      try {
        const res = await educacionMedicaApi.rutas.agregarVisita(ruta.idRuta, {
          idSeleccionHospital,
          fechaVisita: fecha,
          orden,
        });
        if (res.data.success) {
          const aviso = res.data.data?.aviso;
          if (aviso) toast.warning(aviso);
          else toast.success('Visita agregada.');
          setErroresAgregar((prev) => {
            const next = { ...prev };
            delete next[idSeleccionHospital];
            return next;
          });
          setEditadoManual(true);
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
    if (!editable || !payload || !over) return;
    if (over.id === 'sin-planificar') {
      if (payload.tipo === 'visita') void quitarVisita(payload.visita);
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
        const h = dict.get(v.idSeleccionHospital);
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
          Ir a Selección y reparto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RutasHeader
        seleccion={seleccion}
        versiones={versionesInfo}
        version={version}
        estadoVersion={estadoVersion}
        onVersionChange={(v) => {
          setVersion(v);
          setEquipoSeleccionado(null);
          setErroresAgregar({});
        }}
        onBack={() => navigate('/educacion-medica/seleccion')}
      />

      {!loading && rutasVisibles.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {resumenEquipos.length} {resumenEquipos.length === 1 ? 'equipo' : 'equipos'} ·{' '}
          {planificadas}/{totalHospitales} planificadas · {sinPlanificarTotal} sin planificar
          {advertenciasTotales > 0 && (
            <span className="text-amber-600"> · {advertenciasTotales} advertencias</span>
          )}
        </p>
      )}

      {(seleccion?.estado === 'Autorizada' || rutasVisibles.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchTodo(version)} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          {rutasVisibles.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setModalImprimir(true)}>
              <Printer className="mr-2 h-4 w-4" />
              Vista de impresión
            </Button>
          )}
          <div className="flex-1" />
          {seleccion?.estado === 'Autorizada' && estadoVersion !== 'Confirmada' && (
            <>
              <div
                className="flex items-center gap-1.5"
                title="Cómo reparte el sistema las visitas al generar la propuesta. Siempre es una sugerencia: puedes mover visitas después."
              >
                <span className="text-xs text-muted-foreground">Criterio</span>
                <Select
                  value={estrategia}
                  onValueChange={(v) => setEstrategia(v as EstrategiaReparto)}
                >
                  <SelectTrigger className="h-8 w-[225px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ciudad">
                      Ciudades juntas (una ciudad por día)
                    </SelectItem>
                    <SelectItem value="centroide">
                      Compacto (por distancia al centroide)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" disabled={guardando} onClick={onClickRegenerar}>
                {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {hayDraft ? 'Regenerar propuesta' : 'Generar propuesta'}
              </Button>
            </>
          )}
          {seleccion?.estado === 'Autorizada' && estadoVersion === 'Confirmada' && (
            <Button variant="outline" size="sm" onClick={() => setModalCancelar(true)}>
              <Undo2 className="mr-2 h-4 w-4" />
              Solicitar cambio
            </Button>
          )}
          {hayDraft && editable && (
            <Button size="sm" disabled={guardando} onClick={confirmar} className="font-semibold">
              <Gavel className="mr-2 h-4 w-4" />
              Confirmar rutas
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
        <div className="rounded-lg border bg-card p-8 text-center">
          {seleccion?.estado === 'Autorizada' ? (
            <>
              <p className="text-sm font-medium">
                No hay una propuesta de rutas para esta selección.
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                La selección está autorizada y contiene {totalHospitales}{' '}
                hospital{totalHospitales === 1 ? '' : 'es'}. Genera una propuesta inicial para
                comenzar a calendarizar las visitas.{alertasAccion.cantidad > 0 && ' Atención:'}
                {alertasAccion.cantidad > 0 && (
                  <>
                    {' '}
                    {alertasAccion.cantidad} hospital(es) no tienen región o equipo asignado y
                    quedarán sin planificar hasta que los corrijas en Reparto.
                  </>
                )}
              </p>
              <Button className="mt-4" disabled={guardando} onClick={onClickRegenerar}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generar propuesta
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Esta selección aún no tiene rutas.</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Autoriza la selección (doble firma GV + GG) en el paso Autorización para poder
                planificar rutas.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/educacion-medica/seleccion')}>
                Ir a Selección y reparto
              </Button>
            </>
          )}
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
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">{equipoActivo.nombre}</p>
                  <span className="text-xs text-muted-foreground">{equipoActivo.integrantes}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {equipoActivo.totalVisitas} planificadas · {equipoActivo.sinPlanificar} sin
                  planificar ·{' '}
                  <span
                    className={
                      equipoActivo.foraneos > maxViajesForaneos ? 'font-semibold text-destructive' : ''
                    }
                  >
                    Viajes foráneos {equipoActivo.foraneos}/{maxViajesForaneos}
                  </span>
                </p>
              </div>

              <SinPlanificarPanel
                items={sinPlanificarPara(equipoActivo.idEquipo)}
                errores={erroresAgregar}
                editable={editable}
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
                        editable={editable}
                        dragActivo={dragPayload}
                        ubicacionPorVisita={ubicacionPorVisita}
                        onRetornar={(visita) => void quitarVisita(visita)}
                        onVerMapa={abrirMapaDia}
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
              <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm shadow-lg ring-1 ring-primary/40">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" />
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
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Las rutas confirmadas pasarán a Cancelada y podrás generar una nueva propuesta. Queda
            huella por versiones.
          </p>
          <Input
            placeholder="Motivo del cambio..."
            value={motivoCancelar}
            onChange={(e) => setMotivoCancelar(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
