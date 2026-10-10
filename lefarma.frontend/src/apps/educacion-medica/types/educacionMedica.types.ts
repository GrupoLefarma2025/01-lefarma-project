import type {
  AccionHandlerMetadata,
  WorkflowCampoMetadata,
} from '@/components/workflows/workflowAccion';

export interface HospitalExtension {
  idHospitalExtension: number;
  idHospital: number;
  fecha: string | null;
  idTipoGerencia: number | null;
  tipoGerencia: string | null;
  idRegion: number | null;
  regionNombre: string | null;
  conSia: boolean | null;
  numeroQuirofanos: number | null;
  esZonaMetropolitana: boolean | null;
  anestesiasTotales: number | null;
  anestesiasGenerales: number | null;
  anestesiasRegionales: number | null;
  anestesiasEpidurales: number | null;
  anestesiasSubdurales: number | null;
  anestesiasMixtasObesos: number | null;
  anestesiasMixtasNoObesos: number | null;
  /** Contacto logístico tipo almacén (no sede de taller). */
  esAlmacen: boolean | null;
  /** Contacto logístico tipo farmacia. */
  esFarmacia: boolean | null;
  /** 1 = sede de taller seleccionable; 0 = logístico; NULL = sin clasificar. */
  esSedeTaller: boolean | null;
}

export interface Hospital {
  codigoContacto: number;
  nombreContacto: string;
  nombreCorto: string | null;
  clues: string | null;
  ciudad: string | null;
  codigoEstado: string | null;
  activo: number | null;
  codigoContactoPrincipal: number | null;
  institucion: string | null;
  latitud: number | null;
  longitud: number | null;
  esInstitucion: boolean;
  extension: HospitalExtension | null;
}

/** Resumen de la sincronización de extensiones de hospitales. */
export interface SincronizarHospitalesResponse {
  totalHospitales: number;
  creadas: number;
  yaExistian: number;
}

export interface HospitalUbicacion {
  codigoContacto: number;
  nombreContacto: string;
  nombreCorto: string | null;
  clues: string | null;
  ciudad: string | null;
  codigoEstado: string | null;
  latitud: number | null;
  longitud: number | null;
  idRegion: number | null;
  regionNombre: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface HospitalFilterParams {
  search?: string;
  modoInstitucion?: string;
  conSia?: boolean | null;
  idTipoGerencia?: number | null;
  idRegion?: number | null;
  numeroQuirofanosMin?: number | null;
  anestesiasTotalesMin?: number | null;
  activo?: boolean | null;
  /** true = solo con coordenadas validas (no nulas ni 0/0); false = solo sin ellas */
  tieneCoordenadas?: boolean | null;
  /** "sedes" = solo sedes de taller (excluye logísticos 0, conserva NULL) | "logisticos" | "sin-clasificar" */
  filtroSede?: string;
  orderBy?: string;
  orderDirection?: string;
  page?: number;
  pageSize?: number;
}

export interface Producto {
  codigoProducto: number;
  nombre: string;
  descripcionCorta: string | null;
  tipo: string | null;
  tipoAsokam: string | null;
  marcaImss: string | null;
}

export interface TipoGerencia {
  idTipoGerencia: number;
  descripcion: string;
  /** Hospitales con extensión activa asignados a esta gerencia. */
  totalHospitales: number;
}

export interface RegionEstadoResumen {
  codigoEstado: number;
  nombreEstado: string | null;
}

export interface Region {
  idRegion: number;
  idTipoGerencia: number;
  nombreGerencia: string | null;
  nombre: string;
  centroLatitud: number | null;
  centroLongitud: number | null;
  activo: boolean;
  cantidadHospitales: number;
  estados: RegionEstadoResumen[];
}

export interface UpsertRegionRequest {
  idTipoGerencia: number;
  nombre: string;
  centroLatitud?: number | null;
  centroLongitud?: number | null;
  activo?: boolean | null;
  codigoEstados?: number[];
}

export interface EstadoCatalogo {
  codigoEstado: number;
  nombreEstado: string;
  idRegion: number | null;
  nombreRegion: string | null;
}

export interface SugerenciaRegionOpcion {
  idRegion: number;
  nombreRegion: string;
  distanciaKm: number | null;
}

export interface SugerenciaRegionResponse {
  porEstado: SugerenciaRegionOpcion | null;
  porGps: SugerenciaRegionOpcion | null;
}

export interface AplicarMapeoDetalle {
  codigoEstado: number;
  nombreEstado: string | null;
  idRegion: number;
  nombreRegion: string | null;
  hospitales: number;
}

export interface AplicarMapeoGpsDetalle {
  idRegion: number;
  nombreRegion: string | null;
  hospitales: number;
}

export interface AplicarMapeoResponse {
  detalles: AplicarMapeoDetalle[];
  totalHospitales: number;
  detallesGps: AplicarMapeoGpsDetalle[];
  totalPorGps: number;
  sinCoordenadas: number;
}

export interface RegionEstado {
  codigoEstado: number;
  nombreEstado: string | null;
  idRegion: number;
  nombreRegion: string | null;
  idTipoGerencia?: number;
  nombreGerencia?: string | null;
}

export interface UpsertRegionEstadoRequest {
  idRegion: number;
}

export interface AsignarRegionHospitalRequest {
  idRegion: number | null;
}

export interface UpsertHospitalExtensionRequest {
  fecha: string | null;
  idTipoGerencia: number | null;
  idRegion: number | null;
  conSia: boolean | null;
  numeroQuirofanos: number | null;
  esZonaMetropolitana: boolean | null;
  esAlmacen: boolean | null;
  esFarmacia: boolean | null;
  esSedeTaller: boolean | null;
}

export interface ParametroAnestesia {
  idParametroAnestesia: number;
  anio: number;
  clave: string;
  valor: number;
  descripcion: string | null;
  orden: number;
}

export interface UpsertParametroAnestesiaItemRequest {
  clave: string;
  valor: number;
}

export interface UpsertParametrosAnestesiasRequest {
  parametros: UpsertParametroAnestesiaItemRequest[];
}

export interface RecalcularAnestesiasResponse {
  anio: number;
  registrosActualizados: number;
}

export interface UsuarioCatalogo {
  idUsuario: number;
  nombreCompleto: string;
  correo: string;
}

export interface EquipoPareo {
  idEquipo: number;
  idRegion: number;
  nombreRegion: string | null;
  idEjecutivo: number;
  nombreEjecutivo: string;
  idEspecialista: number;
  nombreEspecialista: string;
  fechaInicio: string;
  fechaFin: string | null;
  activo: boolean;
  regionesActuales: string[];
}

export interface CrearEquipoPareoRequest {
  idEjecutivo: number;
  idEspecialista: number;
  idRegion: number;
  fechaInicio?: string | null;
}

export interface AsignarRegionEquipoRequest {
  idRegion: number;
}

export interface EquipoPareoFiltros {
  soloVigentes?: boolean | null;
  busqueda?: string;
  idUsuario?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface EquipoRegionOperada {
  idRegion: number;
  nombre: string;
  cantidadHospitales: number;
}

export interface EquipoRutaOperada {
  idRuta: number;
  version: number;
  estado: string;
  fechaConfirmacion: string | null;
  totalVisitas: number;
}

export interface EquipoParticipacion {
  idSeleccionMensual: number;
  fechaSeleccion: string;
  estadoSeleccion: string;
  regiones: EquipoRegionOperada[];
  rutas: EquipoRutaOperada[];
}

export interface EquipoOperacion {
  idEquipo: number;
  nombreEjecutivo: string;
  nombreEspecialista: string;
  fechaInicio: string;
  fechaFin: string | null;
  activo: boolean;
  totalSelecciones: number;
  totalVisitasConfirmadas: number;
  participaciones: EquipoParticipacion[];
}

export interface SeleccionMensual {
  idSeleccionMensual: number;
  fechaSeleccion: string;
  idTipoGerencia: number | null;
  tipoGerencia: string | null;
  fechaInicioVigencia: string | null;
  fechaFinVigencia: string | null;
  talleresObjetivoMes: number | null;
  estado: 'Creada' | 'EnRevision' | 'Cerrada' | 'Rechazada' | 'Cancelada';
  firmaGvFecha: string | null;
  firmaGgFecha: string | null;
  totalHospitales: number;
  totalRegiones: number;
  /** Existe al menos una propuesta de rutas para la selección (habilita el acceso desde el listado). */
  tieneRutas: boolean;
  /** Fecha de creación del registro (columna Fecha del listado). */
  fechaCreacion: string;
  idWorkflow: number | null;
  idPasoActual: number | null;
  /** Estado del workflow (catálogo config.workflow_estados); mismo criterio que la bandeja. */
  idEstado: number | null;
  estadoNombre: string | null;
  estadoColor: string | null;
  /** Nombre del paso actual del workflow (columna Etapa del listado). */
  pasoActualNombre: string | null;
  /** Nombre del usuario creador (columna Creado por del listado). */
  nombreUsuarioCreacion: string | null;
  /** Acciones disponibles para el usuario en el paso actual; vacío si no es su turno. */
  acciones: AccionDisponible[];
}

export interface SeleccionHospital {
  idSeleccionHospital: number;
  idHospital: number | null;
  nombreHospital: string | null;
  region: string | null;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  productoAPromocionar: string | null;
  observaciones: string | null;
  latitudSnapshot: number | null;
  longitudSnapshot: number | null;
  idRegion: number | null;
  nombreRegion: string | null;
  /** Equipo de pareo de la región del hospital (solo lectura). */
  idEquipo: number | null;
  nombreEjecutivo: string | null;
  nombreEspecialista: string | null;
  scoreSugerencia: number | null;
  /** Origen de la asignación de región: null = catálogo/manual | "GPS" = fallback por centroide. */
  origen: string | null;
  /** Cómo se agregó: "Manual" | "Sugerencia". */
  tipoAlta: string | null;
  institucion: string | null;
  numeroQuirofanos: number | null;
  anestesiasTotales: number | null;
}

export interface SeleccionRegion {
  idRegion: number;
  nombre: string | null;
  centroLatitud: number | null;
  centroLongitud: number | null;
  cantidadHospitales: number;
  idEquipo: number | null;
  nombreEquipo: string | null;
  idRegionCatalogo: number | null;
  algoritmo: string | null;
  fechaCalculo: string;
  advertenciaMinimo: boolean;
}

export interface SeleccionDetalle extends SeleccionMensual {
  hospitales: SeleccionHospital[];
  regiones: SeleccionRegion[];
}

export type CriterioCercania = "distancia" | "mismoEstado" | "mismaCiudad";

export interface HospitalCercanoOtraSeleccion {
  idSeleccionHospitalAjeno: number;
  idHospital: number | null;
  nombreHospital: string | null;
  gerenciaOrigen: string | null;
  idSeleccionMensualOrigen: number;
  fechaSeleccionOrigen: string;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  latitud: number | null;
  longitud: number | null;
  distanciaKm: number | null;
  criterio: CriterioCercania;
  idSeleccionHospitalCercano: number | null;
  nombreHospitalCercano: string | null;
}

export interface CrearSeleccionMensualRequest {
  fechaSeleccion: string;
  idTipoGerencia?: number | null;
  fechaInicioVigencia: string;
  fechaFinVigencia: string;
  talleresObjetivoMes?: number | null;
}

export interface AgregarHospitalSeleccionRequest {
  idHospital: number;
  productoAPromocionar?: string | null;
  observaciones?: string | null;
}

export interface AsignarEquipoRegionRequest {
  idEquipo: number;
}

export interface DividirRegionRequest {
  motivo: string;
}

export interface MoverHospitalARegionRequest {
  idRegion: number;
}

export interface FirmarWorkflowRequest {
  idAccion: number;
  comentario?: string | null;
  /** Valores de campos dinámicos configurados en la acción (handlers Field/Document). */
  datosAdicionales?: Record<string, unknown> | null;
}

/**
 * Acción del motor de workflow disponible para el usuario en el paso actual.
 * Incluye la metadata de firma dinámica (handlers/campos/adjuntos) que arma
 * el backend; la UI solo la usa cuando la acción la configura.
 */
export interface AccionDisponible {
  idAccion: number;
  idTipoAccion: number;
  tipoAccionCodigo?: string | null;
  tipoAccionNombre?: string | null;
  tipoAccionDescripcion?: string | null;
  tipoAccionCambiaEstado?: boolean | null;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  permiteAdjunto?: boolean;
  handlers?: AccionHandlerMetadata[];
  camposWorkflow?: WorkflowCampoMetadata[];
  camposRequeridos?: string[];
}

export interface HistorialWorkflowItem {
  idEvento: number;
  idEntidad: number;
  idPaso: number;
  nombrePaso?: string | null;
  idAccion: number;
  nombreAccion?: string | null;
  idUsuario: number;
  nombreUsuario?: string | null;
  comentario?: string | null;
  /** Snapshot JSON del evento (transiciones, omisiones automáticas, datos adicionales). */
  datosSnapshot?: string | null;
  fechaEvento: string;
}

/** Estado de autorización de una versión de rutas (workflow Creada → GV → CA → DC → Cerrada). */
export interface RutaVersionDto {
  idRutaVersion: number;
  version: number;
  estado: 'Creada' | 'Cerrada' | 'Rechazada' | 'Cancelada' | 'Archivada';
  /** Workflow de la versión (para el historial). */
  idWorkflow: number | null;
  idPasoActual: number | null;
  pasoNombre: string | null;
  /** Estado del workflow (catálogo config.workflow_estados): nombre y color para la UI. */
  idEstado: number | null;
  estadoNombre: string | null;
  estadoColor: string | null;
  esEditable: boolean;
  esFinal: boolean;
  acciones: AccionDisponible[];
}

/** Item de la Bandeja de Autorizaciones del módulo. */
export interface PendienteAprobacion {
  tipo: 'seleccion' | 'rutas' | 'matriz';
  idEntidad: number;
  idSeleccionMensual: number;
  /** Matriz general cuando el documento es de tipo `matriz`. */
  idMatrizGeneral?: number | null;
  /** Workflow del documento (para dibujar el flujo en el historial). */
  idWorkflow: number | null;
  idPasoActual: number | null;
  documento: string;
  detalle: string | null;
  idUsuarioCreador: number | null;
  nombreUsuarioCreador: string | null;
  pasoNombre: string | null;
  /** Estado de dominio (Creada, EnRevision, Cerrada... / Creada, Cerrada...). */
  estado: string | null;
  /** Estado del workflow (catálogo config.workflow_estados), mismo criterio que RH. */
  idEstado: number | null;
  estadoNombre: string | null;
  estadoColor: string | null;
  /** Fecha de creación del documento (convención única para ambos tipos). */
  fecha?: string | null;
  /** Número de versión cuando el documento es de rutas. */
  versionRutas?: number | null;
  /** Acciones disponibles para el usuario en el paso actual; vacío si no es su turno. */
  acciones: AccionDisponible[];
}

export interface AgruparSeleccionResponse {
  regiones: SeleccionRegion[];
  avisos: string[];
}

export interface RutaVisita {
  idRutaVisita: number;
  idRuta: number;
  idSeleccionHospital: number | null;
  idHospital: number | null;
  nombreHospital: string | null;
  fechaVisita: string;
  orden: number;
  /** TimeOnly del backend: 'HH:mm:ss'. */
  horaSalida?: string | null;
  /** TimeOnly del backend: 'HH:mm:ss'. */
  horaLlegada?: string | null;
  esForanea: boolean;
  /** 1 = visita extraordinaria (hospital del catálogo fuera de la selección; ADR-00011). */
  esExtraordinaria?: boolean;
  idRegion: number | null;
  nombreRegion: string | null;
  aviso?: string | null;
  /** Avisos no bloqueantes del modo ajuste (capacidad excedida; ADR-00010). */
  avisos?: string[];
}

export interface Ruta {
  idRuta: number;
  idSeleccionMensual: number;
  idEquipo: number;
  nombreEquipo: string;
  version: number;
  nombre: string | null;
  estado: 'Creada' | 'Cerrada' | 'Rechazada' | 'Cancelada' | 'Archivada';
  fechaConfirmacion: string | null;
  visitas: RutaVisita[];
}

export interface GenerarRutasResponse {
  version: number;
  estrategia: string;
  rutas: Ruta[];
  avisos: string[];
}

export type EstrategiaReparto = 'ciudad' | 'centroide';

export interface Asignacion {
  idRutaVisita: number;
  idRuta: number;
  nombreRuta: string | null;
  idSeleccionMensual: number;
  idSeleccionHospital: number | null;
  fechaVisita: string;
  orden: number;
  idHospital: number | null;
  nombreHospital: string | null;
  nombreRegion: string | null;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  institucion: string | null;
  /** 1 = visita extraordinaria (ADR-00011). */
  esExtraordinaria?: boolean;
  /** Ubicación del hospital (snapshot de la selección; respaldo del catálogo). */
  latitud: number | null;
  longitud: number | null;
  calle: string | null;
  colonia: string | null;
  codigoPostal: string | null;
  email: string | null;
}

export interface MoverVisitaRequest {
  fechaVisita: string;
  orden: number;
  /** Motivo del ajuste post-cierre (obligatorio con la versión Cerrada; ADR-00010). */
  motivo?: string | null;
}

export interface AgregarVisitaRequest {
  idSeleccionHospital: number;
  fechaVisita: string;
  orden: number;
  /** Motivo del ajuste post-cierre (obligatorio con la versión Cerrada; ADR-00010). */
  motivo?: string | null;
}

/** Edición de horas de la visita (normal en Creada; ajuste auditado en Cerrada; ADR-00010). */
export interface EditarHorasVisitaRequest {
  horaSalida?: string | null;
  horaLlegada?: string | null;
  motivo?: string | null;
}

/** Alta de visita extraordinaria: hospital del catálogo fuera de la selección (ADR-00011). */
export interface VisitaExtraordinariaRequest {
  idEquipo: number;
  idHospital: number;
  fechaVisita: string;
  orden?: number | null;
  motivo: string;
}

/** Hospital elegible para la captura asistida (ADR-00011). */
export interface HospitalElegible {
  idSeleccionHospital: number;
  idSeleccionMensual: number;
  idHospital: number | null;
  nombreHospital: string | null;
  region: string | null;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  idRuta: number;
  fechaVisita: string;
}

/** Entrada de la bitácora de ajustes post-cierre (ADR-00010). */
export interface AjustePostCierre {
  idAjuste: number;
  entidadTipo: 'RUTA_VISITA' | 'RUTA_VERSION' | 'TALLER';
  idEntidad: number;
  accion: string;
  valoresAntes: string | null;
  valoresDespues: string | null;
  motivo: string;
  idUsuario: number;
  nombreUsuario: string | null;
  fechaAjuste: string;
}

export interface CancelarRutasRequest {
  motivo: string;
}

export interface ParametroModulo {
  clave: string;
  valor: number;
  descripcion: string | null;
}

export interface UpsertParametroModuloRequest {
  clave: string;
  valor: number;
}

export interface RankingFactorItem {
  clave: string;
  grupo: string | null;
  valorCrudo: number | null;
  scoreFactor: number;
  pesoConfigurado: number;
  pesoEfectivo: number;
  puntosAportados: number;
  datoDisponible: boolean;
  aplicado: boolean;
  motivoNoAplicado: string | null;
}

export interface RankingHospitalItem {
  idHospital: number;
  nombreHospital: string | null;
  institucion: string | null;
  codigoEstado: string | null;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  posicion: number;
  scoreTotal: number;
  porcentajeCompletitud: number;
  esTopSugerido: boolean;
  datoCoordenadasDisponible: boolean | null;
  factores: RankingFactorItem[];
}

export interface ConfigRankingResumen {
  idConfiguracion: number;
  nombre: string;
  version: number;
  activo: boolean;
  usada: boolean;
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  fechaCreacion: string;
}

export interface RankingGerenciaFiltro {
  id: number;
  descripcion: string;
}

export interface RankingFiltros {
  gerencia: RankingGerenciaFiltro | null;
  activo: boolean;
  excluyeTipos: string[];
  excluyeYaAgregados: boolean;
  search?: string | null;
  codigoEstado?: string | null;
  estadoNombre?: string | null;
  zonaMetropolitana?: boolean | null;
  idRegion?: number | null;
  nombreRegion?: string | null;
  reglaVersion: string;
}

export interface RankingFactorCatalogo {
  clave: string;
  nombre: string;
  descripcion: string;
  grupo: string | null;
}

export interface RankingEjecucion {
  idRankingEjecucion: number;
  idSeleccionMensual: number;
  configuracion: ConfigRankingResumen;
  versionAlgoritmo: string;
  cantidadSolicitada: number;
  cantidadCandidatos: number;
  cantidadYaAgregados: number;
  pesosEfectivos: Record<string, number>;
  factoresCatalogo?: RankingFactorCatalogo[];
  filtros?: RankingFiltros | null;
  ranking: RankingHospitalItem[];
}

export interface EstadoFiltro {
  codigo: string;
  nombre: string | null;
}

export interface FiltrosDisponibles {
  estados: EstadoFiltro[];
  regiones: RegionFiltro[];
  locales: number;
  foraneos: number;
  sinClasificacion: number;
  totalCandidatos: number;
}

export interface RegionFiltro {
  idRegion: number;
  nombre: string;
}

export interface GenerarRankingRequest {
  cantidad: number;
  search?: string | null;
  codigoEstado?: string | null;
  zonaMetropolitana?: boolean | null;
  idRegion?: number | null;
}

export interface HospitalLoteItemRequest {
  idHospital: number;
  productoAPromocionar?: string | null;
}

export interface AgregarHospitalesLoteRequest {
  idRankingEjecucion?: number | null;
  hospitales: HospitalLoteItemRequest[];
}

export interface ConfigRankingFactor {
  idFactor: number;
  clave: string;
  grupo: string | null;
  nombre: string;
  descripcion: string;
  peso: number;
  activo: boolean;
  tipoNormalizacion: string | null;
  parametrosJson: string | null;
}

export interface ConfigRanking {
  idConfiguracion: number;
  nombre: string;
  version: number;
  activo: boolean;
  usada: boolean;
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  fechaCreacion: string;
  factores: ConfigRankingFactor[];
}

export interface ConfigRankingVersion {
  idConfiguracion: number;
  nombre: string;
  version: number;
  activo: boolean;
  fechaCreacion: string;
}

export interface ConfigRankingConVersiones extends ConfigRanking {
  versiones: ConfigRankingVersion[];
}

export interface UpsertConfigRankingFactorRequest {
  clave: string;
  grupo?: string | null;
  nombre: string;
  descripcion: string;
  peso: number;
  activo: boolean;
  tipoNormalizacion?: string | null;
  parametrosJson?: string | null;
}

export interface UpsertConfigRankingRequest {
  nombre: string;
  activo?: boolean;
  factores: UpsertConfigRankingFactorRequest[];
}

// ─── Matriz de Talleres (FOR-005) ────────────────────────────────────────────

/** Tipos de recurso del taller (constantes del backend: Producto/Folleto/Envio/BoxLunch). */
export type TipoRecursoTaller = 'Producto' | 'Folleto' | 'Envio' | 'BoxLunch';

export interface TallerRecurso {
  idTallerRecurso: number;
  tipoRecurso: string;
  idProducto: string | null;
  /** Nombre visible del producto (catálogo); solo en recursos tipo Producto. */
  nombreProducto: string | null;
  descripcion: string | null;
  tipoEnvio: string | null;
  cantidad: number | null;
  costoUnitario: number | null;
  subtotal: number | null;
  observaciones: string | null;
}

export interface Taller {
  idTaller: number;
  idSeleccionHospital: number | null;
  idHospital: number | null;
  nombreHospital: string | null;
  region: string | null;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  numeroParticipantes: number | null;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  unidadMedica: string | null;
  lugar: string | null;
  /** DateOnly del backend: 'YYYY-MM-DD'. */
  fechaTaller: string | null;
  /** TimeOnly del backend: 'HH:mm:ss'. */
  horaTaller: string | null;
  requiereEquipoProyeccion: boolean | null;
  tipoEquipoProyeccion: string | null;
  estado: string;
  observaciones: string | null;
  idMatrizIndividual: number | null;
  idMatrizGeneral: number | null;
  /** Fecha real de cierre (estado Realizado; ADR-00008). */
  fechaRealizado?: string | null;
  /** 1 = taller extraordinario (ADR-00011). */
  esExtraordinario?: boolean;
  motivoExtraordinario?: string | null;
  /** "Capturado por" cuando el usuario no pertenece al equipo (captura asistida CEM). */
  idUsuarioCreacion?: number | null;
  capturadoPor?: string | null;
  /** Solicitud de cambio pendiente del equipo (join; ADR-00010). */
  solicitudCambioPendiente?: TallerSolicitudCambioResumen | null;
  recursos: TallerRecurso[];
  /** Suma de los subtotales de los recursos (calculada en el servicio). */
  costoTotal: number;
}

/** Matriz individual de un equipo de pareo (equipo + mes). */
export interface MatrizIndividual {
  idMatrizIndividual: number;
  idEquipo: number;
  /** DateOnly del backend: 'YYYY-MM-DD' (siempre día 1). */
  periodo: string;
  /** 0 = captura abierta; 1 = captura bloqueada (generada). */
  esBloqueado: boolean;
  fechaBloqueo: string | null;
  fechaDesbloqueo: string | null;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  totalTalleres: number;
}

/** Respuesta de "Mis talleres": equipo, matriz individual del mes y talleres capturados. */
export interface MisTalleresResponse {
  idEquipo: number | null;
  nombreRegion: string | null;
  nombreEjecutivo: string | null;
  nombreEspecialista: string | null;
  periodo: string;
  matriz: MatrizIndividual | null;
  /** Estado real del workflow de la matriz general (Creada → GV → AEM → CA → DC → Cerrada). */
  estadoMatrizGeneral: string | null;
  /** Color del estado del workflow (catálogo config.workflow_estados). */
  estadoMatrizGeneralColor: string | null;
  /** Paso actual del workflow de la matriz general. */
  pasoActualMatrizGeneral: string | null;
  talleres: Taller[];
}

/** Recurso capturado por el equipo (sin costos; los costos los registra el AEM). */
export interface GuardarTallerRecursoRequest {
  tipoRecurso: string;
  idProducto?: string | null;
  descripcion?: string | null;
  tipoEnvio?: string | null;
  cantidad?: number | null;
  observaciones?: string | null;
}

/** Alta de un taller (campos FOR-005 1–12; hospital/región se derivan de la selección). */
export interface CrearTallerRequest {
  /** Hospital de la selección; obligatorio en el modo normal (null en extraordinario). */
  idSeleccionHospital?: number | null;
  /** Equipo explícito para la captura asistida del CEM (ADR-00011). */
  idEquipo?: number | null;
  /** Modo extraordinario: hospital del catálogo fuera de la selección (ADR-00011). */
  esExtraordinario?: boolean;
  /** Hospital del catálogo Asokam; obligatorio en el modo extraordinario. */
  idHospital?: number | null;
  /** Motivo obligatorio del taller extraordinario. */
  motivoExtraordinario?: string | null;
  numeroParticipantes?: number | null;
  unidadMedica?: string | null;
  lugar?: string | null;
  fechaTaller?: string | null;
  horaTaller?: string | null;
  requiereEquipoProyeccion?: boolean | null;
  tipoEquipoProyeccion?: string | null;
  observaciones?: string | null;
  recursos?: GuardarTallerRecursoRequest[] | null;
}

/** Edición de un taller (la liga a la selección/hospital no cambia). */
export interface ActualizarTallerRequest {
  numeroParticipantes?: number | null;
  unidadMedica?: string | null;
  lugar?: string | null;
  fechaTaller?: string | null;
  horaTaller?: string | null;
  requiereEquipoProyeccion?: boolean | null;
  tipoEquipoProyeccion?: string | null;
  observaciones?: string | null;
  /** Motivo del ajuste post-cierre (obligatorio con el taller Autorizado/Programado; ADR-00010). */
  motivo?: string | null;
  recursos?: GuardarTallerRecursoRequest[] | null;
}

// ─── Impartición de talleres (ADR-00008) ─────────────────────────────────────

/** Material del taller (FOR-007) con la confirmación de recepción del EV. */
export interface TallerMaterial {
  idTallerMaterial: number;
  idTaller: number;
  fechaEntrega: string | null;
  cargoPuesto: string | null;
  nombreProducto: string | null;
  cantidadProducto: number | null;
  incluyeListaAsistencia: boolean | null;
  incluyeFlayers: boolean | null;
  incluyeEquipoComputo: boolean | null;
  incluyeProyector: boolean | null;
  incluyeDulces: boolean | null;
  incluyeModeloAnatomico: boolean | null;
  nombreEjecutivoRecepcion: string | null;
  observaciones: string | null;
  firmaUrl: string | null;
  fechaRecepcion: string | null;
  idUsuarioRecepcion: number | null;
  nombreUsuarioRecepcion: string | null;
  /** true cuando el EV ya confirmó la recepción. */
  confirmado: boolean;
}

export interface GuardarTallerMaterialRequest {
  fechaEntrega?: string | null;
  cargoPuesto?: string | null;
  nombreProducto?: string | null;
  cantidadProducto?: number | null;
  incluyeListaAsistencia?: boolean | null;
  incluyeFlayers?: boolean | null;
  incluyeEquipoComputo?: boolean | null;
  incluyeProyector?: boolean | null;
  incluyeDulces?: boolean | null;
  incluyeModeloAnatomico?: boolean | null;
  nombreEjecutivoRecepcion?: string | null;
  observaciones?: string | null;
}

export interface ConfirmarMaterialRequest {
  nombreEjecutivoRecepcion?: string | null;
}

/** Asistente del taller (FOR-008, máx. 20). */
export interface TallerAsistencia {
  idAsistencia: number;
  idTaller: number;
  numero: number;
  nombreMedico: string;
  cedulaProfesional: string | null;
  puestoMedico: string | null;
  telefonoCelular: string | null;
  correoElectronico: string | null;
  observaciones: string | null;
}

export interface GuardarTallerAsistenciaRequest {
  numero: number;
  nombreMedico: string;
  cedulaProfesional?: string | null;
  puestoMedico?: string | null;
  telefonoCelular?: string | null;
  correoElectronico?: string | null;
  observaciones?: string | null;
}

export interface TallerEvidencia {
  idEvidencia: number;
  idTaller: number;
  tipoEvidencia: string;
  archivoUrl: string;
  descripcion: string | null;
  fechaEvidencia: string | null;
}

export interface GuardarTallerEvidenciaRequest {
  tipoEvidencia: string;
  archivoUrl: string;
  descripcion?: string | null;
  fechaEvidencia?: string | null;
}

/** Transición manual del taller: EnCurso, Realizado o Cancelado. */
export interface CambiarEstadoTallerRequest {
  nuevoEstado: string;
  motivo?: string | null;
}

export interface TallerEstadoHistorial {
  idHistorial: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
  origen: 'Automatico' | 'Manual';
  motivo: string | null;
  idUsuario: number | null;
  nombreUsuario: string | null;
  fecha: string;
}

/** Solicitud de cambio del equipo (ADR-00010, decisiones 13-15). */
export interface TallerSolicitudCambioResumen {
  idSolicitud: number;
  datosJson: string | null;
  idSolicitante: number | null;
  nombreSolicitante: string | null;
  fecha: string;
}

export interface CrearSolicitudCambioRequest {
  motivo: string;
  fechaTaller?: string | null;
  horaTaller?: string | null;
  lugar?: string | null;
  numeroParticipantes?: number | null;
}

export interface ResolverSolicitudCambioRequest {
  aprobar: boolean;
  motivo: string;
}

export interface TallerSolicitudCambio {
  idSolicitud: number;
  idTaller: number;
  estado: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Cancelada';
  datosJson: string | null;
  fechaCreacion: string;
  fechaModificacion: string;
  idUsuarioCreacion: number | null;
  nombreUsuarioCreacion: string | null;
  idUsuarioModificacion: number | null;
  nombreUsuarioModificacion: string | null;
}

/** Documento imprimible FOR-007 (material) pre-llenado. */
export interface TallerDocumentoMaterial {
  taller: Taller;
  material: TallerMaterial | null;
}

/** Documento imprimible FOR-008 (asistencia) pre-llenado. */
export interface TallerDocumentoAsistencia {
  taller: Taller;
  asistencias: TallerAsistencia[];
}

/** Resumen de una matriz general (lista por gerencia/mes). */
export interface MatrizGeneralResumen {
  idMatrizGeneral: number;
  idTipoGerencia: number;
  gerencia: string | null;
  periodo: string;
  idWorkflow: number | null;
  idPasoActual: number | null;
  pasoNombre: string | null;
  idEstado: number | null;
  estadoNombre: string | null;
  estadoColor: string | null;
  totalTalleres: number;
  costoTotal: number;
}

/** Detalle de la matriz general: talleres con recursos, totales y acciones del workflow. */
export interface MatrizTalleresDetalle extends MatrizGeneralResumen {
  esEditable: boolean;
  esFinal: boolean;
  talleres: Taller[];
  acciones: AccionDisponible[];
}

/** Panel "Matrices por equipo" de la concentración (captura de cada matriz individual). */
export interface ConcentracionEquipo {
  idMatrizIndividual: number;
  idEquipo: number;
  nombreRegion: string | null;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  /** 0 = captura abierta; 1 = captura bloqueada (generada). */
  esBloqueado: boolean;
  fechaBloqueo: string | null;
  fechaDesbloqueo: string | null;
  totalTalleres: number;
}

/** Recurso con costo capturado por el AEM en el paso de costos. */
export interface GuardarCostoRecursoRequest {
  tipoRecurso: string;
  idProducto?: string | null;
  descripcion?: string | null;
  tipoEnvio?: string | null;
  cantidad?: number | null;
  costoUnitario?: number | null;
  observaciones?: string | null;
}

/** Reemplazo del conjunto de recursos/costos de un taller (paso del AEM). */
export interface ActualizarCostosTallerRequest {
  recursos: GuardarCostoRecursoRequest[];
}

export interface MatrizDocumentoFirma {
  pasoNombre: string | null;
  idUsuario: number;
  nombreUsuario: string | null;
  comentario: string | null;
  fecha: string;
}

/** Documento imprimible de la matriz (layout FOR-005). */
export interface MatrizDocumento {
  titulo: string;
  gerencia: string | null;
  periodo: string;
  pasoNombre: string | null;
  estadoNombre: string | null;
  talleres: Taller[];
  costoTotal: number;
  firmas: MatrizDocumentoFirma[];
}
