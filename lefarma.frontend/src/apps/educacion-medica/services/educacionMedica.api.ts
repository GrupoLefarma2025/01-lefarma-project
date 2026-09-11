import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  Hospital,
  HospitalExtension,
  HospitalFilterParams,
  HospitalUbicacion,
  PagedResult,
  Producto,
  TipoGerencia,
  UpsertHospitalExtensionRequest,
  Region,
  UpsertRegionRequest,
  RegionEstado,
  UpsertRegionEstadoRequest,
  AsignarRegionHospitalRequest,
  EstadoCatalogo,
  SugerenciaRegionResponse,
  AplicarMapeoResponse,
  ParametroAnestesia,
  UpsertParametrosAnestesiasRequest,
  RecalcularAnestesiasResponse,
  UsuarioCatalogo,
  EquipoPareo,
  CrearEquipoPareoRequest,
  EquipoPareoFiltros,
  EquipoOperacion,
  AsignarRegionEquipoRequest,
  SeleccionMensual,
  SeleccionDetalle,
  CrearSeleccionMensualRequest,
  AgregarHospitalSeleccionRequest,
  AsignarEquipoRegionRequest,
  DividirRegionRequest,
  MoverHospitalARegionRequest,
  HospitalCercanoOtraSeleccion,
  AutorizarSeleccionRequest,
  AgruparSeleccionResponse,
  SeleccionHospital,
  SeleccionRegion,
  Ruta,
  GenerarRutasResponse,
  Asignacion,
  MoverVisitaRequest,
  AgregarVisitaRequest,
  CancelarRutasRequest,
  ParametroModulo,
  UpsertParametroModuloRequest,
  RankingEjecucion,
  GenerarRankingRequest,
  AgregarHospitalesLoteRequest,
  FiltrosDisponibles,
  ConfigRankingConVersiones,
  ConfigRankingResumen,
  ConfigRanking,
  UpsertConfigRankingRequest,
} from '../types/educacionMedica.types';

const BASE = '/educacion-medica';

function buildHospitalFilters(filters: HospitalFilterParams): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.search) params.search = filters.search;
  if (filters.modoInstitucion) params.modoInstitucion = filters.modoInstitucion;
  if (filters.conSia !== undefined && filters.conSia !== null) params.conSia = filters.conSia;
  if (filters.idTipoGerencia !== undefined && filters.idTipoGerencia !== null) {
    params.idTipoGerencia = filters.idTipoGerencia;
  }
  if (filters.idRegion !== undefined && filters.idRegion !== null) {
    params.idRegion = filters.idRegion;
  }
  if (filters.numeroQuirofanosMin !== undefined && filters.numeroQuirofanosMin !== null) {
    params.numeroQuirofanosMin = filters.numeroQuirofanosMin;
  }
  if (
    filters.anestesiasTotalesMin !== undefined &&
    filters.anestesiasTotalesMin !== null
  ) {
    params.anestesiasTotalesMin = filters.anestesiasTotalesMin;
  }
  if (filters.activo !== undefined && filters.activo !== null) params.activo = filters.activo;
  if (filters.tieneCoordenadas !== undefined && filters.tieneCoordenadas !== null) {
    params.tieneCoordenadas = filters.tieneCoordenadas;
  }
  if (filters.orderBy) params.orderBy = filters.orderBy;
  if (filters.orderDirection) params.orderDirection = filters.orderDirection;
  if (filters.page !== undefined && filters.page !== null) params.page = filters.page;
  if (filters.pageSize !== undefined && filters.pageSize !== null) params.pageSize = filters.pageSize;
  return params;
}

export const educacionMedicaApi = {
  hospitales: {
    getAll: (filters: HospitalFilterParams = {}) =>
      API.get<ApiResponse<PagedResult<Hospital>>>(`${BASE}/hospitales`, {
        params: buildHospitalFilters(filters),
      }),
    getUbicaciones: (filters: Omit<HospitalFilterParams, 'page' | 'pageSize'> = {}) => {
      const params = buildHospitalFilters({ ...filters, page: undefined, pageSize: undefined });
      delete params.page;
      delete params.pageSize;
      return API.get<ApiResponse<HospitalUbicacion[]>>(`${BASE}/hospitales/ubicaciones`, {
        params,
      });
    },
    getById: (id: number) =>
      API.get<ApiResponse<Hospital>>(`${BASE}/hospitales/${id}`),
    upsertExtension: (id: number, payload: UpsertHospitalExtensionRequest) =>
      API.put<ApiResponse<HospitalExtension>>(
        `${BASE}/hospitales/${id}/extension`,
        payload
      ),
  },
  productos: {
    getAll: (search?: string) =>
      API.get<ApiResponse<Producto[]>>(`${BASE}/productos`, {
        params: search ? { search } : undefined,
      }),
  },
  tipoGerencia: {
    getAll: () =>
      API.get<ApiResponse<TipoGerencia[]>>(`${BASE}/tipo-gerencia`),
  },
  regiones: {
    getAll: () =>
      API.get<ApiResponse<Region[]>>(`${BASE}/regiones`),
    create: (payload: UpsertRegionRequest) =>
      API.post<ApiResponse<Region>>(`${BASE}/regiones`, payload),
    update: (idRegion: number, payload: UpsertRegionRequest) =>
      API.put<ApiResponse<Region>>(`${BASE}/regiones/${idRegion}`, payload),
    getEstadosCatalogo: () =>
      API.get<ApiResponse<EstadoCatalogo[]>>(`${BASE}/regiones/estados-catalogo`),
    getSugerencia: (codigoContacto: number) =>
      API.get<ApiResponse<SugerenciaRegionResponse>>(
        `${BASE}/regiones/sugerencia/${codigoContacto}`
      ),
    previewAplicarMapeo: () =>
      API.post<ApiResponse<AplicarMapeoResponse>>(`${BASE}/regiones/aplicar-mapeo/preview`),
    aplicarMapeo: () =>
      API.post<ApiResponse<{ hospitalesReasignados: number; porEstado: number; porGps: number }>>(
        `${BASE}/regiones/aplicar-mapeo`
      ),
    getMapeoEstados: () =>
      API.get<ApiResponse<RegionEstado[]>>(`${BASE}/regiones/estados`),
    upsertMapeoEstado: (codigoEstado: number, payload: UpsertRegionEstadoRequest) =>
      API.put<ApiResponse<RegionEstado>>(`${BASE}/regiones/estados/${codigoEstado}`, payload),
    asignarHospital: (codigoContacto: number, payload: AsignarRegionHospitalRequest) =>
      API.patch<ApiResponse<HospitalExtension>>(
        `${BASE}/regiones/hospitales/${codigoContacto}`,
        payload
      ),
  },
  parametrosAnestesias: {
    getByAnio: (anio: number) =>
      API.get<ApiResponse<ParametroAnestesia[]>>(
        `${BASE}/parametros-anestesias/${anio}`
      ),
    getActual: () =>
      API.get<ApiResponse<ParametroAnestesia[]>>(
        `${BASE}/parametros-anestesias/actual`
      ),
    upsert: (anio: number, payload: UpsertParametrosAnestesiasRequest) =>
      API.put<ApiResponse<ParametroAnestesia[]>>(
        `${BASE}/parametros-anestesias/${anio}`,
        payload
      ),
    recalcular: (anio: number) =>
      API.post<ApiResponse<RecalcularAnestesiasResponse>>(
        `${BASE}/parametros-anestesias/${anio}/recalcular`
      ),
  },
  usuarios: {
    getAll: () => API.get<ApiResponse<UsuarioCatalogo[]>>(`/auth/usuarios`),
  },
  equiposPareo: {
    getAll: (filtros: EquipoPareoFiltros = {}) => {
      const params: Record<string, unknown> = {};
      if (filtros.soloVigentes !== undefined && filtros.soloVigentes !== null) {
        params.soloVigentes = filtros.soloVigentes;
      }
      if (filtros.busqueda?.trim()) params.busqueda = filtros.busqueda.trim();
      if (filtros.idUsuario) params.idUsuario = filtros.idUsuario;
      if (filtros.fechaInicio) params.fechaInicio = filtros.fechaInicio;
      if (filtros.fechaFin) params.fechaFin = filtros.fechaFin;
      return API.get<ApiResponse<EquipoPareo[]>>(`${BASE}/equipos-pareo`, { params });
    },
    getOperacion: (idEquipo: number) =>
      API.get<ApiResponse<EquipoOperacion>>(`${BASE}/equipos-pareo/${idEquipo}/operacion`),
    create: (payload: CrearEquipoPareoRequest) =>
      API.post<ApiResponse<EquipoPareo>>(`${BASE}/equipos-pareo`, payload),
    asignarRegion: (idEquipo: number, payload: AsignarRegionEquipoRequest) =>
      API.put<ApiResponse<EquipoPareo>>(
        `${BASE}/equipos-pareo/${idEquipo}/region`,
        payload
      ),
    desactivar: (idEquipo: number) =>
      API.put<ApiResponse<EquipoPareo>>(`${BASE}/equipos-pareo/${idEquipo}/desactivar`),
  },
  seleccionesMensuales: {
    getAll: (anio?: number, mes?: number) =>
      API.get<ApiResponse<SeleccionMensual[]>>(`${BASE}/selecciones-mensuales`, {
        params: {
          ...(anio ? { anio } : {}),
          ...(mes ? { mes } : {}),
        },
      }),
    getById: (idSeleccionMensual: number) =>
      API.get<ApiResponse<SeleccionDetalle>>(`${BASE}/selecciones-mensuales/${idSeleccionMensual}`),
    create: (payload: CrearSeleccionMensualRequest) =>
      API.post<ApiResponse<SeleccionMensual>>(`${BASE}/selecciones-mensuales`, payload),
    agregarHospital: (idSeleccionMensual: number, payload: AgregarHospitalSeleccionRequest) =>
      API.post<ApiResponse<SeleccionHospital>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/hospitales`,
        payload
      ),
    quitarHospital: (idSeleccionMensual: number, idSeleccionHospital: number) =>
      API.delete<ApiResponse<unknown>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/hospitales/${idSeleccionHospital}`
      ),
    agrupar: (idSeleccionMensual: number) =>
      API.post<ApiResponse<AgruparSeleccionResponse>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/agrupar`
      ),
    asignarEquipo: (idSeleccionMensual: number, idRegion: number, payload: AsignarEquipoRegionRequest) =>
      API.put<ApiResponse<SeleccionRegion>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/regiones/${idRegion}/equipo`,
        payload
      ),
    dividirRegion: (idSeleccionMensual: number, idRegion: number, payload: DividirRegionRequest) =>
      API.post<ApiResponse<SeleccionRegion[]>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/regiones/${idRegion}/dividir`,
        payload
      ),
    moverHospitalARegion: (
      idSeleccionMensual: number,
      idSeleccionHospital: number,
      payload: MoverHospitalARegionRequest
    ) =>
      API.put<ApiResponse<unknown>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/hospitales/${idSeleccionHospital}/region`,
        payload
      ),
    hospitalesCercanos: (idSeleccionMensual: number) =>
      API.get<ApiResponse<HospitalCercanoOtraSeleccion[]>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/hospitales-cercanos`
      ),
    enviarRevision: (idSeleccionMensual: number) =>
      API.post<ApiResponse<SeleccionMensual>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/enviar-revision`
      ),
    autorizar: (idSeleccionMensual: number, payload: AutorizarSeleccionRequest) =>
      API.post<ApiResponse<SeleccionMensual>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/autorizar`,
        payload
      ),
    cerrar: (idSeleccionMensual: number) =>
      API.post<ApiResponse<SeleccionMensual>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/cerrar`
      ),
    generarRanking: (idSeleccionMensual: number, payload: GenerarRankingRequest) =>
      API.post<ApiResponse<RankingEjecucion>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/ranking`,
        payload
      ),
    obtenerFiltrosDisponibles: (idSeleccionMensual: number) =>
      API.get<ApiResponse<FiltrosDisponibles>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/ranking/filtros-disponibles`
      ),
    obtenerRanking: (idSeleccionMensual: number) =>
      API.get<ApiResponse<RankingEjecucion>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/ranking/ultimo`
      ),
    obtenerRankingEjecucion: (
      idSeleccionMensual: number,
      idRankingEjecucion: number
    ) =>
      API.get<ApiResponse<RankingEjecucion>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/ranking/${idRankingEjecucion}`
      ),
    agregarHospitalesLote: (
      idSeleccionMensual: number,
      payload: AgregarHospitalesLoteRequest
    ) =>
      API.post<ApiResponse<SeleccionHospital[]>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/hospitales/lote`,
        payload
      ),
  },
  configRanking: {
    get: () =>
      API.get<ApiResponse<ConfigRankingConVersiones>>(`${BASE}/config-ranking`),
    listado: () =>
      API.get<ApiResponse<ConfigRankingResumen[]>>(`${BASE}/config-ranking/listado`),
    getById: (idConfiguracion: number) =>
      API.get<ApiResponse<ConfigRanking>>(`${BASE}/config-ranking/${idConfiguracion}`),
    crearNuevaVersion: (idConfiguracion: number) =>
      API.post<ApiResponse<ConfigRanking>>(
        `${BASE}/config-ranking/${idConfiguracion}/nueva-version`
      ),
    update: (idConfiguracion: number, payload: UpsertConfigRankingRequest) =>
      API.put<ApiResponse<ConfigRanking>>(
        `${BASE}/config-ranking/${idConfiguracion}`,
        payload
      ),
  },
  rutas: {
    getBySeleccion: (idSeleccionMensual: number, version?: number) =>
      API.get<ApiResponse<Ruta[]>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/rutas`,
        { params: version !== undefined ? { version } : undefined }
      ),
    generar: (idSeleccionMensual: number, estrategia?: 'ciudad' | 'centroide') =>
      API.post<ApiResponse<GenerarRutasResponse>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/rutas/generar`,
        { estrategia }
      ),
    confirmar: (idSeleccionMensual: number) =>
      API.post<ApiResponse<Ruta[]>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/rutas/confirmar`
      ),
    cancelar: (idSeleccionMensual: number, payload: CancelarRutasRequest) =>
      API.post<ApiResponse<Ruta[]>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/rutas/cancelar`,
        payload
      ),
    moverVisita: (idRuta: number, idRutaVisita: number, payload: MoverVisitaRequest) =>
      API.put<ApiResponse<import('../types/educacionMedica.types').RutaVisita>>(
        `${BASE}/rutas/${idRuta}/visitas/${idRutaVisita}/mover`,
        payload
      ),
    agregarVisita: (idRuta: number, payload: AgregarVisitaRequest) =>
      API.post<ApiResponse<import('../types/educacionMedica.types').RutaVisita>>(
        `${BASE}/rutas/${idRuta}/visitas`,
        payload
      ),
    quitarVisita: (idRuta: number, idRutaVisita: number) =>
      API.delete<ApiResponse<unknown>>(
        `${BASE}/rutas/${idRuta}/visitas/${idRutaVisita}`
      ),
    asignaciones: (idUsuario: number) =>
      API.get<ApiResponse<Asignacion[]>>(`${BASE}/talleres/asignaciones/${idUsuario}`),
  },
  parametrosModulo: {
    getAll: () =>
      API.get<ApiResponse<ParametroModulo[]>>(`${BASE}/parametros-modulo`),
    upsert: (payload: UpsertParametroModuloRequest[]) =>
      API.put<ApiResponse<ParametroModulo[]>>(`${BASE}/parametros-modulo`, payload),
  },
};
