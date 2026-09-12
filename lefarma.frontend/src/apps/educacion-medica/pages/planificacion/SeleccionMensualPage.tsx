import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  Plus,
  Printer,
  RefreshCcw,
  Route as RouteIcon,
  Scissors,
  Sparkles,
  UserCheck,
} from 'lucide-react';import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  AgruparSeleccionResponse,
  EquipoPareo,
  FiltrosDisponibles,
  Hospital,
  HospitalCercanoOtraSeleccion,
  RankingEjecucion,
  SeleccionDetalle,
  SeleccionHospital,
  SeleccionMensual,
  SeleccionRegion,
  TipoGerencia,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { CatalogoSearchSelect } from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import { RankingModal } from '@/apps/educacion-medica/components/RankingModal';
import { RegionesPanel } from '@/apps/educacion-medica/components/RegionesPanel';
import { ResumenSeleccionModal } from '@/apps/educacion-medica/components/ResumenSeleccionModal';

const HospitalesMap = lazy(() =>
  import('@/apps/educacion-medica/components/HospitalesMap').then((m) => ({
    default: m.HospitalesMap,
  }))
);

const ESTADO_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Borrador: 'secondary',
  EnRevision: 'outline',
  Autorizada: 'default',
  Cerrada: 'destructive',
};

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

function VarianteEstado({ estado }: { estado: string }) {
  return <Badge variant={ESTADO_VARIANTS[estado] ?? 'outline'}>{estado}</Badge>;
}

export default function SeleccionMensualPage() {
  usePageTitle('Selección y reparto', 'Educación Médica');
  const navigate = useNavigate();

  const [selecciones, setSelecciones] = useState<SeleccionMensual[]>([]);
  const [seleccionId, setSeleccionId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<SeleccionDetalle | null>(null);
  const [equipos, setEquipos] = useState<EquipoPareo[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState<string | null>(null);
  const [nuevaInicio, setNuevaInicio] = useState<string | null>(null);
  const [nuevaFin, setNuevaFin] = useState<string | null>(null);
  const [nuevoObjetivo, setNuevoObjetivo] = useState('64');
  const [nuevaGerencia, setNuevaGerencia] = useState<number | null>(null);
  const [tiposGerencia, setTiposGerencia] = useState<TipoGerencia[]>([]);

  const [modalHospital, setModalHospital] = useState(false);
  const [gerenciaFiltro, setGerenciaFiltro] = useState<number | null>(null);
  const [hospitalesGerencia, setHospitalesGerencia] = useState<Hospital[]>([]);
  const [cargandoHospitales, setCargandoHospitales] = useState(false);
  const [hospitalElegidoId, setHospitalElegidoId] = useState<number | null>(null);
  const [productoPromocionar, setProductoPromocionar] = useState('');

  const [regionDividir, setRegionDividir] = useState<SeleccionRegion | null>(null);
  const [motivoDivision, setMotivoDivision] = useState('');

  const [modalResumen, setModalResumen] = useState(false);

  const [modalRanking, setModalRanking] = useState(false);
  const [rankingEjecucion, setRankingEjecucion] = useState<RankingEjecucion | null>(null);
  const [rankingCargando, setRankingCargando] = useState(false);
  const [rankingFiltros, setRankingFiltros] = useState<{
    search: string;
    codigoEstado: string | null;
    zonaMetropolitana: boolean | null;
    idRegion: number | null;
  }>({ search: '', codigoEstado: null, zonaMetropolitana: null, idRegion: null });
  const [filtrosDisponibles, setFiltrosDisponibles] = useState<FiltrosDisponibles | null>(null);

  const [avisosAgrupacion, setAvisosAgrupacion] = useState<string[]>([]);

  const [regionesAbiertas, setRegionesAbiertas] = useState<string[]>([]);
  const [regionExpandidaId, setRegionExpandidaId] = useState<number | null>(null);
  const [regionHoverId, setRegionHoverId] = useState<number | null>(null);
  const [hospitalHoverId, setHospitalHoverId] = useState<number | null>(null);
  const [hospitalesCercanos, setHospitalesCercanos] = useState<HospitalCercanoOtraSeleccion[]>([]);
  const [mostrarAjenos, setMostrarAjenos] = useState(true);
  const regionesInicializadasPara = useRef<number | null>(null);

  const manejarRegionesAbiertas = (abiertas: string[]) => {
    const recienAbierta = abiertas.find((id) => !regionesAbiertas.includes(id));
    setRegionExpandidaId(recienAbierta != null ? Number(recienAbierta) : null);
    setRegionesAbiertas(abiertas);
  };

  const fetchSelecciones = useCallback(async () => {
    setLoading(true);
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.getAll();
      if (response.data.success) {
        setSelecciones(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar selecciones');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar selecciones');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetalle = useCallback(async (id: number) => {
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.getById(id);
      if (response.data.success) {
        setDetalle(response.data.data ?? null);
      } else {
        toast.error(response.data.message ?? 'Error al cargar la selección');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar la selección');
    }
  }, []);

  useEffect(() => {
    fetchSelecciones();
    educacionMedicaApi.equiposPareo
      .getAll({ soloVigentes: true })
      .then((response) => {
        if (response.data.success) setEquipos(response.data.data ?? []);
      })
      .catch(() => undefined);
    educacionMedicaApi.tipoGerencia
      .getAll()
      .then((response) => {
        if (response.data.success) setTiposGerencia(response.data.data ?? []);
      })
      .catch(() => undefined);
  }, [fetchSelecciones]);

  useEffect(() => {
    if (seleccionId !== null) {
      fetchDetalle(seleccionId);
    } else {
      setDetalle(null);
    }
  }, [seleccionId, fetchDetalle]);

  const fetchHospitalesCercanos = useCallback(async (id: number) => {
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.hospitalesCercanos(id);
      if (response.data.success) {
        setHospitalesCercanos(response.data.data ?? []);
      }
    } catch {
      // Informativo: una falla aquí no debe bloquear la vista.
    }
  }, []);

  useEffect(() => {
    if (seleccionId === null) {
      setHospitalesCercanos([]);
      return;
    }
    void fetchHospitalesCercanos(seleccionId);
  }, [seleccionId, fetchHospitalesCercanos]);

  // Al cambiar de selección, abrir la primera región con problema (sin equipo > advertencia <4)
  useEffect(() => {
    if (!detalle) return;
    if (regionesInicializadasPara.current === detalle.idSeleccionMensual) return;
    regionesInicializadasPara.current = detalle.idSeleccionMensual;
    const problematica =
      detalle.regiones.find((r) => !r.idEquipo) ??
      detalle.regiones.find((r) => r.advertenciaMinimo) ??
      null;
    setRegionesAbiertas(problematica ? [String(problematica.idRegion)] : []);
    setRegionExpandidaId(problematica?.idRegion ?? null);
  }, [detalle]);

  const refrescar = async () => {
    await fetchSelecciones();
    if (seleccionId !== null) {
      await fetchDetalle(seleccionId);
      await fetchHospitalesCercanos(seleccionId);
    }
  };

  const errorFechasNueva = useMemo(() => {
    if (nuevaInicio && nuevaFin && nuevaFin <= nuevaInicio) {
      return 'La fecha de fin de vigencia debe ser posterior al inicio.';
    }
    return null;
  }, [nuevaInicio, nuevaFin]);

  const abrirModalNueva = () => {
    // Defaults: próximo día 15 de reunión; vigencia de 45 días a partir del día siguiente
    const hoy = new Date();
    const aIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const dia15 = hoy.getDate() <= 15 ? new Date(hoy.getFullYear(), hoy.getMonth(), 15) : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 15);
    const inicio = new Date(dia15);
    inicio.setDate(inicio.getDate() + 1);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 45);

    setNuevaFecha(aIso(dia15));
    setNuevaInicio(aIso(inicio));
    setNuevaFin(aIso(fin));
    setNuevaGerencia(null);
    setModalNueva(true);
  };

  const crearSeleccion = async () => {
    if (!nuevaGerencia) {
      toast.error('Selecciona el tipo de gerencia de la selección.');
      return;
    }
    if (!nuevaFecha || !nuevaInicio || !nuevaFin) {
      toast.error('Completa la fecha de selección y las fechas de vigencia.');
      return;
    }
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.create({
        fechaSeleccion: nuevaFecha,
        idTipoGerencia: nuevaGerencia,
        fechaInicioVigencia: nuevaInicio,
        fechaFinVigencia: nuevaFin,
        talleresObjetivoMes: Number(nuevoObjetivo) || null,
      });
      if (response.data.success && response.data.data) {
        toast.success('Selección creada en Borrador.');
        setModalNueva(false);
        setSeleccionId(response.data.data.idSeleccionMensual);
        await refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al crear la selección');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al crear la selección');
    } finally {
      setGuardando(false);
    }
  };

  const abrirModalHospital = () => {
    setGerenciaFiltro(null);
    setHospitalesGerencia([]);
    setHospitalElegidoId(null);
    setProductoPromocionar('');
    setModalHospital(true);
  };

  const cargarHospitalesGerencia = async (idGerencia: number) => {
    setCargandoHospitales(true);
    setHospitalesGerencia([]);
    setHospitalElegidoId(null);
    try {
      const acumulado: Hospital[] = [];
      for (let page = 1; page <= 10; page++) {
        const response = await educacionMedicaApi.hospitales.getAll({
          idTipoGerencia: idGerencia,
          tieneCoordenadas: true,
          page,
          pageSize: 100,
        });
        if (!response.data.success) {
          toast.error(response.data.message ?? 'Error al cargar hospitales');
          break;
        }
        const paged = response.data.data;
        acumulado.push(...(paged?.items ?? []));
        if (!paged || acumulado.length >= paged.totalCount) break;
      }
      setHospitalesGerencia(acumulado);
      if (acumulado.length === 0) {
        toast.info(
          'No hay hospitales clasificados con esa gerencia. Clasifícalos en la pantalla Hospitales.'
        );
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar hospitales');
    } finally {
      setCargandoHospitales(false);
    }
  };

  const agregarHospital = async () => {
    if (!detalle || !hospitalElegidoId) {
      toast.error('Selecciona un hospital.');
      return;
    }
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.agregarHospital(
        detalle.idSeleccionMensual,
        {
          idHospital: hospitalElegidoId,
          productoAPromocionar: productoPromocionar || null,
        }
      );
      if (response.data.success) {
        toast.success('Hospital agregado a la selección.');
        await refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al agregar el hospital');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al agregar el hospital');
    } finally {
      setGuardando(false);
    }
  };

  const quitarHospital = async (hospital: SeleccionHospital) => {
    if (!detalle) return;
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.quitarHospital(
        detalle.idSeleccionMensual,
        hospital.idSeleccionHospital
      );
      if (response.data.success) {
        await refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al quitar el hospital');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al quitar el hospital');
    }
  };

  const agrupar = async () => {
    if (!detalle) return;
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.agrupar(
        detalle.idSeleccionMensual
      );
      if (response.data.success && response.data.data) {
        const data: AgruparSeleccionResponse = response.data.data;
        setAvisosAgrupacion(data.avisos);
        toast.success(`${data.regiones.length} región(es) recalculadas.`);
        await refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al recalcular regiones');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al recalcular regiones');
    } finally {
      setGuardando(false);
    }
  };

  const asignarEquipo = async (
    region: SeleccionRegion,
    idEquipo: string
  ): Promise<{ ok: boolean; mensaje?: string }> => {
    if (!detalle || idEquipo === 'sin-equipo') return { ok: true };
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.asignarEquipo(
        detalle.idSeleccionMensual,
        region.idRegion,
        { idEquipo: Number(idEquipo) }
      );
      if (response.data.success) {
        toast.success(`Región asignada a ${response.data.data?.nombreEquipo}.`);
        await refrescar();
        return { ok: true };
      }
      return { ok: false, mensaje: response.data.message ?? 'Error al asignar el equipo' };
    } catch (error: unknown) {
      return { ok: false, mensaje: toApiError(error).message ?? 'Error al asignar el equipo' };
    }
  };

  const dividirRegion = async () => {
    if (!detalle || !regionDividir) return;
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.dividirRegion(
        detalle.idSeleccionMensual,
        regionDividir.idRegion,
        { motivo: motivoDivision }
      );
      if (response.data.success) {
        toast.success('Región dividida.');
        setRegionDividir(null);
        setMotivoDivision('');
        await refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al dividir la región');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al dividir la región');
    }
  };

  const moverARegion = async (
    hospital: SeleccionHospital,
    idRegion: number
  ): Promise<{ ok: boolean; mensaje?: string }> => {
    if (!detalle) return { ok: false, mensaje: 'Selección no cargada.' };
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.moverHospitalARegion(
        detalle.idSeleccionMensual,
        hospital.idSeleccionHospital,
        { idRegion }
      );
      if (response.data.success) {
        toast.success('Hospital movido a la región.');
        await refrescar();
        return { ok: true };
      }
      return { ok: false, mensaje: response.data.message ?? 'Error al mover el hospital' };
    } catch (error: unknown) {
      return { ok: false, mensaje: toApiError(error).message ?? 'Error al mover el hospital' };
    }
  };

  const regenerarRanking = async (cantidad: number) => {
    if (!detalle) return;
    setRankingCargando(true);
    try {
      const payload = {
        cantidad,
        search: rankingFiltros.search || null,
        codigoEstado: rankingFiltros.codigoEstado,
        zonaMetropolitana: rankingFiltros.zonaMetropolitana,
        idRegion: rankingFiltros.idRegion,
      };
      const response = await educacionMedicaApi.seleccionesMensuales.generarRanking(
        detalle.idSeleccionMensual,
        payload
      );
      if (response.data.success) {
        setRankingEjecucion(response.data.data ?? null);
      } else {
        toast.error(response.data.message ?? 'Error al generar el ranking');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al generar el ranking');
    } finally {
      setRankingCargando(false);
    }
  };

  const cargarFiltrosDisponibles = async (idSeleccionMensual: number) => {
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.obtenerFiltrosDisponibles(
        idSeleccionMensual
      );
      if (response.data.success) {
        setFiltrosDisponibles(response.data.data ?? null);
      }
    } catch (error: unknown) {
      // No bloquear la experiencia si el endpoint falla
      console.warn('No se pudieron cargar los filtros disponibles', error);
      setFiltrosDisponibles(null);
    }
  };

  const abrirRanking = async () => {
    if (!detalle) return;
    setRankingEjecucion(null);
    setRankingFiltros({ search: '', codigoEstado: null, zonaMetropolitana: null, idRegion: null });
    setFiltrosDisponibles(null);
    setRankingCargando(true);
    setModalRanking(true);
    await cargarFiltrosDisponibles(detalle.idSeleccionMensual);
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.obtenerRanking(
        detalle.idSeleccionMensual
      );
      setRankingEjecucion(response.data.success ? (response.data.data ?? null) : null);
    } catch (error: unknown) {
      // 404 = todavía no hay ranking para esta selección: abrir en estado vacío
      if (!isAxiosError(error) || error.response?.status !== 404) {
        toast.error(toApiError(error).message ?? 'Error al cargar el ranking anterior');
      }
      setRankingEjecucion(null);
    } finally {
      setRankingCargando(false);
    }
  };

  const aplicarRanking = async (hospitales: import('@/apps/educacion-medica/types/educacionMedica.types').RankingHospitalItem[]) => {
    if (!detalle || !rankingEjecucion) return;
    setGuardando(true);
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.agregarHospitalesLote(
        detalle.idSeleccionMensual,
        {
          idRankingEjecucion: rankingEjecucion.idRankingEjecucion,
          hospitales: hospitales.map((h) => ({
            idHospital: h.idHospital,
            productoAPromocionar: null,
          })),
        }
      );
      if (response.data.success) {
        toast.success(`${hospitales.length} hospital(es) agregado(s) a la selección.`);
        setModalRanking(false);
        setRankingEjecucion(null);
        await refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al agregar hospitales');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al agregar hospitales');
    } finally {
      setGuardando(false);
    }
  };

  const accionEstado = async (
    accion: 'enviarRevision' | 'autorizarGV' | 'autorizarGG' | 'cerrar'
  ) => {
    if (!detalle) return;
    setGuardando(true);
    try {
      const api = educacionMedicaApi.seleccionesMensuales;
      const response =
        accion === 'enviarRevision'
          ? await api.enviarRevision(detalle.idSeleccionMensual)
          : accion === 'autorizarGV'
            ? await api.autorizar(detalle.idSeleccionMensual, { rol: 'GV' })
            : accion === 'autorizarGG'
              ? await api.autorizar(detalle.idSeleccionMensual, { rol: 'GG' })
              : await api.cerrar(detalle.idSeleccionMensual);

      if (response.data.success) {
        toast.success(response.data.message || 'Acción aplicada.');
        await refrescar();
      } else {
        toast.error(response.data.message ?? 'No se pudo aplicar la acción');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo aplicar la acción');
    } finally {
      setGuardando(false);
    }
  };

  const hospitalesPorRegion = useMemo(() => {
    const mapa = new Map<number | null, SeleccionHospital[]>();
    for (const hospital of detalle?.hospitales ?? []) {
      const lista = mapa.get(hospital.idRegion) ?? [];
      lista.push(hospital);
      mapa.set(hospital.idRegion, lista);
    }
    return mapa;
  }, [detalle]);

  // Agrupa los cercanos por la región del hospital propio más cercano
  // (null = no se pudo resolver o el hospital propio no tiene región).
  const cercanosPorRegion = useMemo(() => {
    const regionPorHospital = new Map<number, number | null>();
    for (const hospital of detalle?.hospitales ?? []) {
      regionPorHospital.set(hospital.idSeleccionHospital, hospital.idRegion);
    }
    const mapa = new Map<number | null, HospitalCercanoOtraSeleccion[]>();
    for (const cercano of hospitalesCercanos) {
      const idRegion =
        cercano.idSeleccionHospitalCercano != null
          ? (regionPorHospital.get(cercano.idSeleccionHospitalCercano) ?? null)
          : null;
      const lista = mapa.get(idRegion) ?? [];
      lista.push(cercano);
      mapa.set(idRegion, lista);
    }
    return mapa;
  }, [detalle, hospitalesCercanos]);

  const PALETA_REGIONES = [
    '#3f6ea5',
    '#4f8a5b',
    '#a56a3f',
    '#7a4fa5',
    '#3f8a8a',
    '#a54f6e',
    '#8a7a3f',
    '#5b6ea5',
  ];

  const colorPorRegion = useMemo(() => {
    const mapa: Record<number, string> = {};
    detalle?.regiones.forEach((region, i) => {
      mapa[region.idRegion] = PALETA_REGIONES[i % PALETA_REGIONES.length];
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle?.regiones]);

  const mapaRegionId = regionHoverId ?? regionExpandidaId;

  const colorPorRegionEfectivo = useMemo(() => {
    if (mapaRegionId == null || !detalle) return colorPorRegion;
    const efectivo: Record<number, string> = {};
    for (const region of detalle.regiones) {
      efectivo[region.idRegion] = region.idRegion === mapaRegionId ? '#eb6c36' : '#c3c8d1';
    }
    return efectivo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorPorRegion, mapaRegionId, detalle]);

  const focusCodigos = useMemo(() => {
    if (regionExpandidaId == null) return undefined;
    const codigos = (hospitalesPorRegion.get(regionExpandidaId) ?? [])
      .filter((h) => h.latitudSnapshot != null && h.longitudSnapshot != null)
      .map((h) => h.idSeleccionHospital);
    return codigos.length > 0 ? codigos : undefined;
  }, [regionExpandidaId, hospitalesPorRegion]);

  const editable = detalle?.estado === 'Borrador' || detalle?.estado === 'EnRevision';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={abrirModalNueva}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva selección
          </Button>
          <Button variant="outline" size="sm" onClick={refrescar}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecciones mensuales</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : selecciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay selecciones. Crea la de la reunión del día 15.
            </p>
          ) : (
            selecciones.map((seleccion) => (
              <Button
                key={seleccion.idSeleccionMensual}
                variant={seleccionId === seleccion.idSeleccionMensual ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSeleccionId(seleccion.idSeleccionMensual)}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {formatearFecha(seleccion.fechaSeleccion)} · {seleccion.totalHospitales} hosp.
                <Badge variant={ESTADO_VARIANTS[seleccion.estado] ?? 'outline'} className="ml-2">
                  {seleccion.estado}
                </Badge>
              </Button>
            ))
          )}
        </CardContent>
      </Card>

      {detalle && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Selección #{detalle.idSeleccionMensual} ·{' '}
                {formatearFecha(detalle.fechaSeleccion)}
                {detalle.tipoGerencia ? ` · ${detalle.tipoGerencia}` : ''}
              </CardTitle>
              <VarianteEstado estado={detalle.estado} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Vigencia</p>
                  <p>
                    {formatearFecha(detalle.fechaInicioVigencia)} —{' '}
                    {formatearFecha(detalle.fechaFinVigencia)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hospitales</p>
                  <p>{detalle.totalHospitales}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Regiones</p>
                  <p>{detalle.totalRegiones}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Objetivo talleres/mes</p>
                  <p>{detalle.talleresObjetivoMes ?? '—'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setModalResumen(true)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Resumen
                </Button>
                {detalle.estado === 'Borrador' && (
                  <Button
                    size="sm"
                    disabled={guardando}
                    onClick={() => accionEstado('enviarRevision')}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Enviar a autorización
                  </Button>
                )}
                {detalle.estado === 'EnRevision' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={guardando || detalle.firmaGvFecha !== null}
                      onClick={() => accionEstado('autorizarGV')}
                    >
                      {detalle.firmaGvFecha ? '✓' : '1.'} Firma Gerente de Ventas
                    </Button>
                    <Button
                      size="sm"
                      disabled={guardando || detalle.firmaGvFecha === null || detalle.firmaGgFecha !== null}
                      onClick={() => accionEstado('autorizarGG')}
                    >
                      {detalle.firmaGgFecha ? '✓' : '2.'} Firma Gerencia General
                    </Button>
                  </>
                )}
                {detalle.estado === 'Autorizada' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate(`/educacion-medica/seleccion/${detalle.idSeleccionMensual}/rutas`)
                      }
                    >
                      <RouteIcon className="mr-2 h-4 w-4" />
                      Planificar rutas
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={guardando}
                      onClick={() => accionEstado('cerrar')}
                    >
                      Cerrar selección
                    </Button>
                  </>
                )}
                {editable && (
                  <>
                    <Button size="sm" variant="outline" onClick={abrirModalHospital}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar hospital
                    </Button>
                    <Button size="sm" variant="outline" disabled={guardando || rankingCargando} onClick={abrirRanking}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Sugerir hospitales
                    </Button>
                    <Button size="sm" variant="outline" disabled={guardando} onClick={agrupar}>
                      <Scissors className="mr-2 h-4 w-4" />
                      Recalcular regiones
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {avisosAgrupacion.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Avisos de la agrupación</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {avisosAgrupacion.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardContent className="pt-6">
                <RegionesPanel
                  regiones={detalle.regiones}
                  hospitalesPorRegion={hospitalesPorRegion}
                  totalHospitales={detalle.totalHospitales}
                  equipos={equipos}
                  editable={editable}
                  guardando={guardando}
                  regionesAbiertas={regionesAbiertas}
                  onRegionesAbiertasChange={manejarRegionesAbiertas}
                  onHoverRegion={setRegionHoverId}
                  onHoverHospital={setHospitalHoverId}
                  onAsignarEquipo={asignarEquipo}
                  onQuitarHospital={quitarHospital}
                  onDividir={setRegionDividir}
                  onRecalcular={() => void agrupar()}
                  onMoverARegion={moverARegion}
                  cercanosPorRegion={cercanosPorRegion}
                />
              </CardContent>
            </Card>

            <div className="space-y-2 self-start lg:sticky lg:top-4">
              <Suspense
                fallback={
                  <div className="flex h-[40vh] items-center justify-center rounded-md border bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                }
              >
                <HospitalesMap
                  hospitales={detalle.hospitales.map((hospital) => ({
                    codigoContacto: hospital.idSeleccionHospital,
                    nombreContacto: hospital.nombreHospital ?? `Hospital ${hospital.idHospital}`,
                    nombreCorto: null,
                    clues: null,
                    ciudad: hospital.ciudadMunicipio,
                    codigoEstado: hospital.entidadFederativa,
                    latitud: hospital.latitudSnapshot,
                    longitud: hospital.longitudSnapshot,
                    idRegion: hospital.idRegion,
                    regionNombre: hospital.nombreRegion,
                  }))}
                  centroides={detalle.regiones
                    .filter((region) => region.centroLatitud !== null && region.centroLongitud !== null)
                    .map((region) => ({
                      idRegion: region.idRegion,
                      nombre: region.nombre ?? `Región ${region.idRegion}`,
                      latitud: region.centroLatitud as number,
                      longitud: region.centroLongitud as number,
                      cantidadHospitales: region.cantidadHospitales,
                    }))}
                  colorPorRegion={colorPorRegionEfectivo}
                  colorSinRegion={mapaRegionId != null ? '#c3c8d1' : undefined}
                  highlightCodigo={hospitalHoverId}
                  focusCodigos={focusCodigos}
                  hospitalesAjenos={mostrarAjenos ? hospitalesCercanos : undefined}
                />
              </Suspense>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {detalle.regiones.map((region) => (
                  <span key={region.idRegion} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: colorPorRegion[region.idRegion] }}
                    />
                    {region.nombre ?? `Región ${region.idRegion}`}
                  </span>
                ))}
                {(hospitalesPorRegion.get(null) ?? []).length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: '#2d3142' }}
                    />
                    Sin región
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-white bg-[#eb6c36] text-[8px] font-bold text-white shadow-sm">
                    Z
                  </span>
                  Centro de región
                </span>
                {hospitalesCercanos.length > 0 && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-[#eb6c36]" />
                    Otras gerencias ({hospitalesCercanos.length})
                    <Switch
                      checked={mostrarAjenos}
                      onCheckedChange={setMostrarAjenos}
                      className="scale-75"
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Al pasar el cursor o expandir una región, sus hospitales se resaltan en naranja y
                las demás regiones se atenúan en gris.
              </p>
            </div>
          </div>
        </>
      )}

      <Modal
        id="modal-nueva-seleccion"
        open={modalNueva}
        setOpen={setModalNueva}
        title="Nueva selección mensual"
        size="md"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalNueva(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                guardando ||
                !nuevaGerencia ||
                !nuevaFecha ||
                !nuevaInicio ||
                !nuevaFin ||
                Boolean(errorFechasNueva)
              }
              onClick={crearSeleccion}
            >
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo de gerencia</label>
            <CatalogoSearchSelect
              items={tiposGerencia.map((tipo) => ({
                id: tipo.idTipoGerencia,
                label: tipo.descripcion,
              }))}
              value={nuevaGerencia}
              onChange={(id) => setNuevaGerencia(id)}
              placeholder="Selecciona la gerencia..."
            />
            <p className="text-xs text-muted-foreground">
              Gerencia responsable de la selección. La meta de talleres es por gerencia (al menos
              64 IMSS / 64 descentralizados); cada gerencia firma su propia selección.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fecha de la reunión (día 15)</label>
            <DatePicker value={nuevaFecha} onChange={setNuevaFecha} placeholder="Seleccionar" />
            <p className="text-xs text-muted-foreground">
              Reunión mensual donde se eligen los hospitales de los próximos 45 días (normalmente
              el día 15 o el siguiente día hábil).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Inicio de vigencia</label>
            <DatePicker value={nuevaInicio} onChange={setNuevaInicio} placeholder="Seleccionar" />
            <p className="text-xs text-muted-foreground">
              Primer día del periodo que se va a planificar.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fin de vigencia (~45 días)</label>
            <DatePicker value={nuevaFin} onChange={setNuevaFin} placeholder="Seleccionar" />
            <p className="text-xs text-muted-foreground">
              Último día del periodo. Las rutas se distribuyen entre los días laborales (Lun–Vie)
              de este rango; la capacidad de cada equipo se calcula sobre estas fechas.
            </p>
            {errorFechasNueva && <p className="text-xs text-destructive">{errorFechasNueva}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Objetivo de talleres del mes</label>
            <Input
              type="number"
              min={1}
              value={nuevoObjetivo}
              onChange={(e) => setNuevoObjetivo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Meta mínima de talleres a programar en el mes. Se usa la operación documentada: al
              menos 64 por gerencia (~128 en total), configurable aquí y en Parámetros.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        id="modal-agregar-hospital"
        open={modalHospital}
        setOpen={setModalHospital}
        title="Agregar hospital a la selección"
        size="md"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalHospital(false)}>
              Cancelar
            </Button>
            <Button
              disabled={guardando || !hospitalElegidoId}
              onClick={agregarHospital}
            >
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo de gerencia</label>
            <CatalogoSearchSelect
              items={tiposGerencia.map((tipo) => ({
                id: tipo.idTipoGerencia,
                label: tipo.descripcion,
              }))}
              value={gerenciaFiltro}
              onChange={(id) => {
                setGerenciaFiltro(id);
                if (id) void cargarHospitalesGerencia(id);
              }}
              placeholder="Selecciona la gerencia..."
            />
            <p className="text-xs text-muted-foreground">
              Solo se listan hospitales clasificados con esa gerencia en la pantalla Hospitales.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Hospital</label>
            {cargandoHospitales ? (
              <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando hospitales...
              </div>
            ) : (
              <CatalogoSearchSelect
                items={hospitalesGerencia
                  .filter(
                    (hospital) =>
                      !detalle?.hospitales.some((h) => h.idHospital === hospital.codigoContacto)
                  )
                  .map((hospital) => ({
                    id: hospital.codigoContacto,
                    label: hospital.nombreContacto,
                    description:
                      [hospital.ciudad, hospital.institucion].filter(Boolean).join(' · ') ||
                      undefined,
                  }))}
                value={hospitalElegidoId}
                onChange={(id) => setHospitalElegidoId(id)}
                placeholder={
                  gerenciaFiltro ? 'Buscar hospital...' : 'Primero selecciona la gerencia'
                }
                disabled={!gerenciaFiltro}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Los hospitales ya agregados a la selección no aparecen en la lista.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Producto a promocionar (opcional)</label>
            <Input
              value={productoPromocionar}
              onChange={(e) => setProductoPromocionar(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        id="modal-dividir-region"
        open={regionDividir !== null}
        setOpen={(open) => !open && setRegionDividir(null)}
        title={`Dividir ${regionDividir?.nombre ?? 'región'}`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRegionDividir(null)}>
              Cancelar
            </Button>
            <Button onClick={dividirRegion} disabled={motivoDivision.trim().length < 5}>
              Dividir
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            La mitad más alejada del centroide formará una región nueva. Esta es una excepción
            manual a la regla de una región por equipo; documenta el motivo.
          </p>
          <Input
            placeholder="Motivo de la división..."
            value={motivoDivision}
            onChange={(e) => setMotivoDivision(e.target.value)}
          />
        </div>
      </Modal>

      {detalle && (
        <ResumenSeleccionModal
          open={modalResumen}
          onOpenChange={setModalResumen}
          detalle={detalle}
          equipos={equipos}
        />
      )}

      <RankingModal
        key={rankingEjecucion?.idRankingEjecucion ?? 0}
        open={modalRanking}
        onOpenChange={setModalRanking}
        ejecucion={rankingEjecucion}
        onAplicar={aplicarRanking}
        guardando={guardando}
        cargando={rankingCargando}
        onRegenerar={regenerarRanking}
        cantidadDefault={detalle?.talleresObjetivoMes ?? null}
        filtrosDisponibles={filtrosDisponibles}
        filtros={rankingFiltros}
        onFiltrosChange={setRankingFiltros}
      />
    </div>
  );
}
