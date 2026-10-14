import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  Hospital,
  HospitalExtension,
  HospitalFilterParams,
  HospitalUbicacion,
  SincronizarHospitalesResponse,
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
  FirmarWorkflowRequest,
  AccionDisponible,
  HistorialWorkflowItem,
  RutaVersionDto,
  PendienteAprobacion,
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
  MisTalleresResponse,
  Taller,
  CrearTallerRequest,
  ActualizarTallerRequest,
  MatrizIndividual,
  MatrizGeneralResumen,
  MatrizTalleresDetalle,
  ConcentracionEquipo,
  ActualizarCostosTallerRequest,
  MatrizDocumento,
  RutaVisita,
  EditarHorasVisitaRequest,
  VisitaExtraordinariaRequest,
  HospitalElegible,
  AjustePostCierre,
  TallerMaterial,
  GuardarTallerMaterialRequest,
  ConfirmarMaterialRequest,
  TallerAsistencia,
  GuardarTallerAsistenciaRequest,
  TallerEvidencia,
  GuardarTallerEvidenciaRequest,
  CambiarEstadoTallerRequest,
  TallerEstadoHistorial,
  CrearSolicitudCambioRequest,
  ResolverSolicitudCambioRequest,
  TallerSolicitudCambio,
  TallerDocumentoMaterial,
  TallerDocumentoAsistencia,
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
  if (filters.filtroSede) params.filtroSede = filters.filtroSede;
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
    sincronizar: () =>
      API.post<ApiResponse<SincronizarHospitalesResponse>>(
        `${BASE}/hospitales/sincronizar`
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
    getAll: (idTipoGerencia?: number) =>
      API.get<ApiResponse<Region[]>>(`${BASE}/regiones`, {
        params: { idTipoGerencia },
      }),
    create: (payload: UpsertRegionRequest) =>
      API.post<ApiResponse<Region>>(`${BASE}/regiones`, payload),
    update: (idRegion: number, payload: UpsertRegionRequest) =>
      API.put<ApiResponse<Region>>(`${BASE}/regiones/${idRegion}`, payload),
    getEstadosCatalogo: (idTipoGerencia?: number) =>
      API.get<ApiResponse<EstadoCatalogo[]>>(`${BASE}/regiones/estados-catalogo`, {
        params: { idTipoGerencia },
      }),
    getSugerencia: (codigoContacto: number) =>
      API.get<ApiResponse<SugerenciaRegionResponse>>(
        `${BASE}/regiones/sugerencia/${codigoContacto}`
      ),
    previewAplicarMapeo: (idTipoGerencia?: number | null) =>
      API.post<ApiResponse<AplicarMapeoResponse>>(`${BASE}/regiones/aplicar-mapeo/preview`, null, {
        params: { idTipoGerencia },
      }),
    aplicarMapeo: (idTipoGerencia?: number | null) =>
      API.post<ApiResponse<{ hospitalesReasignados: number; porEstado: number; porGps: number }>>(
        `${BASE}/regiones/aplicar-mapeo`,
        null,
        { params: { idTipoGerencia } }
      ),
    getMapeoEstados: (idTipoGerencia?: number) =>
      API.get<ApiResponse<RegionEstado[]>>(`${BASE}/regiones/estados`, {
        params: { idTipoGerencia },
      }),
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
    firmar: (idSeleccionMensual: number, payload: FirmarWorkflowRequest) =>
      API.post<ApiResponse<SeleccionMensual>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/firmar`,
        payload
      ),
    accionesDisponibles: (idSeleccionMensual: number) =>
      API.get<ApiResponse<AccionDisponible[]>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/acciones-disponibles`
      ),
    historial: (idSeleccionMensual: number) =>
      API.get<ApiResponse<HistorialWorkflowItem[]>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/historial`
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
    version: (idSeleccionMensual: number, version?: number) =>
      API.get<ApiResponse<RutaVersionDto | null>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/rutas/version`,
        { params: version !== undefined ? { version } : undefined }
      ),
    firmarVersion: (idRutaVersion: number, payload: FirmarWorkflowRequest) =>
      API.post<ApiResponse<RutaVersionDto>>(
        `${BASE}/rutas/version/${idRutaVersion}/firmar`,
        payload
      ),
    historialVersion: (idRutaVersion: number) =>
      API.get<ApiResponse<HistorialWorkflowItem[]>>(
        `${BASE}/rutas/version/${idRutaVersion}/historial`
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
    editarHoras: (idRuta: number, idRutaVisita: number, payload: EditarHorasVisitaRequest) =>
      API.put<ApiResponse<RutaVisita>>(
        `${BASE}/rutas/${idRuta}/visitas/${idRutaVisita}/horas`,
        payload
      ),
    agregarVisita: (idRuta: number, payload: AgregarVisitaRequest) =>
      API.post<ApiResponse<import('../types/educacionMedica.types').RutaVisita>>(
        `${BASE}/rutas/${idRuta}/visitas`,
        payload
      ),
    agregarVisitaExtraordinaria: (
      idSeleccionMensual: number,
      payload: VisitaExtraordinariaRequest
    ) =>
      API.post<ApiResponse<RutaVisita>>(
        `${BASE}/selecciones-mensuales/${idSeleccionMensual}/rutas/visitas-extraordinarias`,
        payload
      ),
    quitarVisita: (idRuta: number, idRutaVisita: number, motivo?: string | null) =>
      API.delete<ApiResponse<unknown>>(
        `${BASE}/rutas/${idRuta}/visitas/${idRutaVisita}`,
        { params: motivo ? { motivo } : undefined }
      ),
    hospitalesElegibles: (idEquipo: number) =>
      API.get<ApiResponse<HospitalElegible[]>>(`${BASE}/talleres/hospitales-elegibles`, {
        params: { idEquipo },
      }),
    asignaciones: () =>
      API.get<ApiResponse<Asignacion[]>>(`${BASE}/talleres/asignaciones`),
  },
  ajustes: {
    listar: (entidadTipo: AjustePostCierre['entidadTipo'], idEntidad: number) =>
      API.get<ApiResponse<AjustePostCierre[]>>(`${BASE}/ajustes`, {
        params: { entidadTipo, idEntidad },
      }),
  },
  aprobaciones: {
    getDocumentos: (filtro: 'pendientes' | 'mios' | 'todos' = 'pendientes') =>
      API.get<ApiResponse<PendienteAprobacion[]>>(`${BASE}/aprobaciones/documentos`, {
        params: { filtro },
      }),
  },
  talleres: {
    misTalleres: (periodo?: string) =>
      API.get<ApiResponse<MisTalleresResponse>>(`${BASE}/talleres/mis-talleres`, {
        params: periodo ? { periodo } : undefined,
      }),
    crear: (payload: CrearTallerRequest) =>
      API.post<ApiResponse<Taller>>(`${BASE}/talleres`, payload),
    actualizar: (idTaller: number, payload: ActualizarTallerRequest) =>
      API.put<ApiResponse<Taller>>(`${BASE}/talleres/${idTaller}`, payload),
    eliminar: (idTaller: number) =>
      API.delete<ApiResponse<unknown>>(`${BASE}/talleres/${idTaller}`),
    generarMatrizIndividual: (idMatrizIndividual: number) =>
      API.post<ApiResponse<MatrizIndividual>>(
        `${BASE}/talleres/matrices-individuales/${idMatrizIndividual}/generar`
      ),
    reabrirMatrizIndividual: (idMatrizIndividual: number) =>
      API.post<ApiResponse<MatrizIndividual>>(
        `${BASE}/talleres/matrices-individuales/${idMatrizIndividual}/reabrir`
      ),
    // Impartición (ADR-00008)
    material: (idTaller: number) =>
      API.get<ApiResponse<TallerMaterial | null>>(`${BASE}/talleres/${idTaller}/material`),
    guardarMaterial: (idTaller: number, payload: GuardarTallerMaterialRequest) =>
      API.put<ApiResponse<TallerMaterial>>(`${BASE}/talleres/${idTaller}/material`, payload),
    confirmarMaterial: (idTaller: number, payload: ConfirmarMaterialRequest) =>
      API.post<ApiResponse<TallerMaterial>>(
        `${BASE}/talleres/${idTaller}/material/confirmar`,
        payload
      ),
    asistencias: (idTaller: number) =>
      API.get<ApiResponse<TallerAsistencia[]>>(`${BASE}/talleres/${idTaller}/asistencias`),
    crearAsistencia: (idTaller: number, payload: GuardarTallerAsistenciaRequest) =>
      API.post<ApiResponse<TallerAsistencia>>(`${BASE}/talleres/${idTaller}/asistencias`, payload),
    actualizarAsistencia: (
      idTaller: number,
      idAsistencia: number,
      payload: GuardarTallerAsistenciaRequest
    ) =>
      API.put<ApiResponse<TallerAsistencia>>(
        `${BASE}/talleres/${idTaller}/asistencias/${idAsistencia}`,
        payload
      ),
    eliminarAsistencia: (idTaller: number, idAsistencia: number) =>
      API.delete<ApiResponse<unknown>>(`${BASE}/talleres/${idTaller}/asistencias/${idAsistencia}`),
    evidencias: (idTaller: number) =>
      API.get<ApiResponse<TallerEvidencia[]>>(`${BASE}/talleres/${idTaller}/evidencias`),
    agregarEvidencia: (idTaller: number, payload: GuardarTallerEvidenciaRequest) =>
      API.post<ApiResponse<TallerEvidencia>>(`${BASE}/talleres/${idTaller}/evidencias`, payload),
    eliminarEvidencia: (idTaller: number, idEvidencia: number) =>
      API.delete<ApiResponse<unknown>>(`${BASE}/talleres/${idTaller}/evidencias/${idEvidencia}`),
    cambiarEstado: (idTaller: number, payload: CambiarEstadoTallerRequest) =>
      API.post<ApiResponse<Taller>>(`${BASE}/talleres/${idTaller}/estado`, payload),
    estados: (idTaller: number) =>
      API.get<ApiResponse<TallerEstadoHistorial[]>>(`${BASE}/talleres/${idTaller}/estados`),
    documentoMaterial: (idTaller: number) =>
      API.get<ApiResponse<TallerDocumentoMaterial>>(
        `${BASE}/talleres/${idTaller}/documento-material`
      ),
    documentoAsistencia: (idTaller: number) =>
      API.get<ApiResponse<TallerDocumentoAsistencia>>(
        `${BASE}/talleres/${idTaller}/documento-asistencia`
      ),
    // Solicitudes de cambio del equipo (ADR-00010)
    crearSolicitudCambio: (idTaller: number, payload: CrearSolicitudCambioRequest) =>
      API.post<ApiResponse<TallerSolicitudCambio>>(
        `${BASE}/talleres/${idTaller}/solicitudes-cambio`,
        payload
      ),
    resolverSolicitudCambio: (idSolicitud: number, payload: ResolverSolicitudCambioRequest) =>
      API.post<ApiResponse<TallerSolicitudCambio>>(
        `${BASE}/talleres/solicitudes-cambio/${idSolicitud}/resolver`,
        payload
      ),
    solicitudesCambio: (idTaller: number) =>
      API.get<ApiResponse<TallerSolicitudCambio[]>>(
        `${BASE}/talleres/${idTaller}/solicitudes-cambio`
      ),
  },
  matricesTalleres: {
    getAll: (gerencia?: number, periodo?: string) =>
      API.get<ApiResponse<MatrizGeneralResumen[]>>(`${BASE}/matrices-talleres`, {
        params: {
          ...(gerencia ? { gerencia } : {}),
          ...(periodo ? { periodo } : {}),
        },
      }),
    getById: (idMatrizGeneral: number) =>
      API.get<ApiResponse<MatrizTalleresDetalle>>(`${BASE}/matrices-talleres/${idMatrizGeneral}`),
    concentracion: (idMatrizGeneral: number) =>
      API.get<ApiResponse<ConcentracionEquipo[]>>(
        `${BASE}/matrices-talleres/${idMatrizGeneral}/concentracion`
      ),
    actualizarCostos: (
      idMatrizGeneral: number,
      idTaller: number,
      payload: ActualizarCostosTallerRequest
    ) =>
      API.put<ApiResponse<Taller>>(
        `${BASE}/matrices-talleres/${idMatrizGeneral}/talleres/${idTaller}/costos`,
        payload
      ),
    firmar: (idMatrizGeneral: number, payload: FirmarWorkflowRequest) =>
      API.post<ApiResponse<MatrizTalleresDetalle>>(
        `${BASE}/matrices-talleres/${idMatrizGeneral}/firmar`,
        payload
      ),
    accionesDisponibles: (idMatrizGeneral: number) =>
      API.get<ApiResponse<AccionDisponible[]>>(
        `${BASE}/matrices-talleres/${idMatrizGeneral}/acciones-disponibles`
      ),
    historial: (idMatrizGeneral: number) =>
      API.get<ApiResponse<HistorialWorkflowItem[]>>(
        `${BASE}/matrices-talleres/${idMatrizGeneral}/historial`
      ),
    documento: (idMatrizGeneral: number) =>
      API.get<ApiResponse<MatrizDocumento>>(
        `${BASE}/matrices-talleres/${idMatrizGeneral}/documento`
      ),
  },
  parametrosModulo: {
    getAll: () =>
      API.get<ApiResponse<ParametroModulo[]>>(`${BASE}/parametros-modulo`),
    upsert: (payload: UpsertParametroModuloRequest[]) =>
      API.put<ApiResponse<ParametroModulo[]>>(`${BASE}/parametros-modulo`, payload),
  },
};
