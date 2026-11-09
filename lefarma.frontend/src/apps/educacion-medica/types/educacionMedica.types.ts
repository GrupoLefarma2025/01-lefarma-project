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
  /** 1 = aparece en el catálogo de Educación Médica. */
  mostrarEducacionMedica: boolean;
  /** Motivo de la clasificación del contacto. */
  motivoClasificacion: string | null;
  /** 1 = pendiente de revisión manual. */
  requiereRevision: boolean;
  /** 1 = clasificación ajustada manualmente. */
  clasificacionManual: boolean;
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
  ocultasNoHospital: number;
  pendientesRevision: number;
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
  /** true = solo visibles en Educación Médica; false = solo ocultos; null/undefined = todos. */
  mostrarEducacionMedica?: boolean | null;
  /** true = solo pendientes de revisión; false = solo revisados. */
  requiereRevision?: boolean | null;
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

export interface TipoVisitaOpcion {
  idTipoVisita: number;
  clave: string;
  descripcion: string;
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
  mostrarEducacionMedica: boolean | null;
  motivoClasificacion: string | null;
  requiereRevision: boolean | null;
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

export interface EjecutivoRegion {
  idEjecutivoRegion: number;
  idUsuario: number;
  nombreUsuario: string;
  idRegionCatalogo: number;
  nombreRegion: string;
  idTipoGerencia: number;
  nombreGerencia: string;
  activo: boolean;
}

export interface CrearEjecutivoRegionRequest {
  idUsuario: number;
  idRegionCatalogo: number;
}

export interface ActualizarEjecutivoRegionRequest {
  idRegionCatalogo: number;
  activo?: boolean | null;
}

export interface EjecutivoSuplente {
  idEjecutivoSuplente: number;
  idUsuario: number;
  nombreUsuario: string;
  idTipoGerencia: number | null;
  nombreGerencia: string;
  idRegionCatalogo: number | null;
  nombreRegion: string;
  activo: boolean;
}

export interface CrearEjecutivoSuplenteRequest {
  idUsuario: number;
  idTipoGerencia?: number | null;
  idRegionCatalogo?: number | null;
  activo?: boolean;
}

export interface ActualizarEjecutivoSuplenteRequest {
  idTipoGerencia?: number | null;
  idRegionCatalogo?: number | null;
  activo?: boolean | null;
}

export interface EspecialistaGerencia {
  idEspecialistaGerencia: number;
  idTipoGerencia: number;
  nombreGerencia: string;
  activo: boolean;
}

export interface EspecialistaRegionPreferida {
  idEspecialistaRegion: number;
  idRegionCatalogo: number;
  nombreRegion: string;
  activo: boolean;
}

export interface EspecialistaPersona {
  idUsuario: number;
  nombreUsuario: string;
  gerencias: EspecialistaGerencia[];
  regionPreferida: EspecialistaRegionPreferida | null;
  activo: boolean;
}

export interface GuardarEspecialistaRequest {
  idUsuario: number;
  idsTipoGerencia: number[];
  idRegionCatalogo?: number | null;
}

export interface PersonasEjecutivosFiltros {
  busqueda?: string;
  idTipoGerencia?: number | null;
  soloActivos?: boolean | null;
}

export interface PersonasSuplentesFiltros {
  busqueda?: string;
  idTipoGerencia?: number | null;
  soloActivos?: boolean | null;
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
  /** El documento admite edición en su paso/estado actual (sin considerar permisos del usuario). */
  permiteEdicion?: boolean;
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
  /** Equipo de pareo (legacy, solo lectura). */
  idEquipo: number | null;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
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
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  idRegionCatalogo: number | null;
  algoritmo: string | null;
  fechaCalculo: string;
  advertenciaMinimo: boolean;
}

export interface AsignarEjecutivoRegionRequest {
  idEjecutivo: number;
  idEspecialista?: number | null;
}

export interface AsignarEjecutivoHospitalRequest {
  idEjecutivo: number | null;
}

export interface AsignarEjecutivoVisitaRequest {
  idEjecutivo: number | null;
  motivo?: string | null;
}

export interface CalendarioFiltro {
  idSeleccion?: number | null;
  version?: number | null;
  desde?: string | null;
  hasta?: string | null;
  idGerencia?: number | null;
  idGerencias?: number[];
  idRegion?: number | null;
  idEjecutivo?: number | null;
  idEspecialista?: number | null;
  estado?: string | null;
  tipoVisita?: string | null;
}

export interface SugerenciaEspecialista {
  idRutaVisita: number;
  idHospital: number | null;
  nombreHospital: string | null;
  ciudadMunicipio: string | null;
  fechaVisita: string;
  idEspecialista: number;
  nombreEspecialista: string;
  cargaDia: number;
  cargaSemana: number;
  cargaMes: number;
  tieneDiaConsecutivo: boolean;
  mismaInstitucion: boolean;
  institucion: string | null;
  region: string | null;
  haVisitadoHospital: boolean;
  visitasRealizadasHospital: number;
  ultimaVisitaHospital: string | null;
  haVisitadoInstitucion: boolean;
  visitasRealizadasInstitucion: number;
  ultimaVisitaInstitucion: string | null;
  haVisitadoCiudad: boolean;
  visitasRealizadasCiudad: number;
  ultimaVisitaCiudad: string | null;
  haVisitadoRegion: boolean;
  visitasRealizadasRegion: number;
  ultimaVisitaRegion: string | null;
  motivo: string;
}

/** Sugerencia enriquecida para la vista global de varias gerencias. */
export interface SugerenciaEspecialistaCalendario extends SugerenciaEspecialista {
  idSeleccionMensual: number;
  idTipoGerencia: number | null;
  gerencia: string;
}

export interface CalendarioItem {
  idRutaVisita: number;
  idRuta: number;
  idSeleccionMensual: number;
  idTipoGerencia: number | null;
  idTaller: number | null;
  tieneTalleres: boolean;
  talleresCount: number;
  idSeleccionHospital: number | null;
  idHospital: number | null;
  hospital: string | null;
  region: string | null;
  gerencia: string;
  estadoRuta: string;
  institucion: string | null;
  ciudadMunicipio: string | null;
  entidadFederativa: string | null;
  fecha: string;
  orden: number;
  hora: string | null;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  idTipoVisita: number | null;
  tipoVisita: string;
  tema: string | null;
  producto: string | null;
  cantidad: number | null;
  costo: number | null;
  participantes: number | null;
  estado: string;
  esExtraordinario: boolean;
  bloqueado: boolean;
  solicitudCambioPendiente: boolean;
  conflictos: string[];
}

export interface ActividadVisitaTaller {
  idTaller: number;
  tema: string | null;
  producto: string | null;
  fechaTaller: string | null;
  horaTaller: string | null;
  estado: string;
  fechaCreacion: string;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  esIntegranteEquipo: boolean;
  candadoPuesto: boolean;
  idSolicitudPendiente: number | null;
}

export interface ActividadVisitaEvento {
  tipo: string;
  fecha: string;
  idTaller: number | null;
  idSolicitud: number | null;
  titulo: string;
  detalle: string | null;
  actor: string | null;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  antes: string | null;
  despues: string | null;
  motivo: string | null;
}

export interface ActividadVisita {
  idRutaVisita: number;
  idRuta: number;
  hospital: string | null;
  fechaVisita: string;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  candadoPuesto: boolean;
  talleres: ActividadVisitaTaller[];
  eventos: ActividadVisitaEvento[];
}

export interface SeleccionDetalle extends SeleccionMensual {
  hospitales: SeleccionHospital[];
  regiones: SeleccionRegion[];
}

export type CriterioCercania = 'distancia' | 'mismoEstado' | 'mismaCiudad';

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
  /** Mes futuro YYYY-MM; el backend calcula primer y último día. */
  periodo?: string | null;
  fechaSeleccion?: string;
  idTipoGerencia?: number | null;
  fechaInicioVigencia?: string;
  fechaFinVigencia?: string;
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

/** Item de la Bandeja de Autorizaciones del módulo. */
export interface PendienteAprobacion {
  tipo: 'seleccion' | 'matriz';
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
  idEjecutivo: number | null;
  idEspecialista: number | null;
  idTipoVisita: number | null;
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
  entidadFederativa?: string | null;
  ciudadMunicipio?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  aviso?: string | null;
  /** Avisos no bloqueantes del modo ajuste (capacidad excedida; ADR-00010). */
  avisos?: string[];
}

export interface Ruta {
  idRuta: number;
  idSeleccionMensual: number;
  idEquipo: number;
  nombreEquipo: string;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  version: number;
  nombre: string | null;
  estado: 'Creada' | 'Cerrada' | 'Rechazada' | 'Cancelada' | 'Archivada';
  fechaConfirmacion: string | null;
  visitas: RutaVisita[];
}

export interface GenerarRutasResponse {
  version: number;
  idRutaVersion: number;
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
  /** Hora de salida planeada (ADR-00013); null si la ruta no la capturó. */
  horaSalida?: string | null;
  /** Hora de llegada planeada (ADR-00013); null si la ruta no la capturó. */
  horaLlegada?: string | null;
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
  idRutaVisita: number | null;
  /** Tipo del taller (catálogo tipo_visita). */
  idTipoVisita: number | null;
  tipoVisita: string | null;
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
  tema?: string | null;
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

/** Resumen agregado del dashboard (ADR-00012, Fase 2): una sola llamada. */
export interface DashboardResumen {
  periodo: string;
  misTalleres: MisTalleresResponse | null;
  asignaciones: Asignacion[];
  pendientes: PendienteAprobacion[];
  matrices: MatrizGeneralResumen[];
  talleresPeriodo: Taller[];
  solicitudes: Taller[];
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
  /** Tipo del taller (promoción producto nuevo, informativa, captación de queja, otro). */
  idTipoVisita?: number | null;
  /** Visita de la ruta desde la que se crea el taller; hereda hospital, fecha y responsables. */
  idRutaVisita?: number | null;
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
  /** Motivo obligatorio si la fecha obliga a crear una visita en una ruta cerrada. */
  motivoAjuste?: string | null;
  requiereEquipoProyeccion?: boolean | null;
  tipoEquipoProyeccion?: string | null;
  observaciones?: string | null;
  tema?: string | null;
  recursos?: GuardarTallerRecursoRequest[] | null;
}

/** Edición de un taller (la liga a la selección/hospital no cambia). */
export interface ActualizarTallerRequest {
  /** Tipo del taller; null/omitido = no cambiar. */
  idTipoVisita?: number | null;
  numeroParticipantes?: number | null;
  unidadMedica?: string | null;
  lugar?: string | null;
  fechaTaller?: string | null;
  horaTaller?: string | null;
  requiereEquipoProyeccion?: boolean | null;
  tipoEquipoProyeccion?: string | null;
  observaciones?: string | null;
  tema?: string | null;
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
  fechaVisita?: string | null;
  fechaTaller?: string | null;
  horaTaller?: string | null;
  lugar?: string | null;
  numeroParticipantes?: number | null;
  idEjecutivo?: number | null;
  idEspecialista?: number | null;
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
  idRutaVersion: number | null;
  version: number | null;
  estadoRutaVersion: string | null;
  totalTalleres: number;
  costoTotal: number;
}

/** Detalle de la matriz general: talleres con recursos, totales y acciones del workflow. */
export interface MatrizTalleresDetalle extends MatrizGeneralResumen {
  esEditable: boolean;
  esFinal: boolean;
  talleres: Taller[];
  acciones: AccionDisponible[];
  ajustesPostCierre: MatrizAjustePostCierre[];
}

export interface MatrizAjustePostCierre {
  idAjuste: number;
  entidadTipo: string;
  idEntidad: number;
  idTaller?: number | null;
  hospital?: string | null;
  accion: string;
  valoresAntes?: string | null;
  valoresDespues?: string | null;
  motivo: string;
  idUsuario: number;
  nombreUsuario?: string | null;
  fechaAjuste: string;
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
  totalTalleres: number;
}

/** Cobertura de la matriz contra las visitas de la versión de rutas activa. */
export interface MatrizRevision {
  idMatrizGeneral: number;
  idTipoGerencia: number;
  gerencia: string | null;
  periodo: string;
  capturaAbierta: boolean;
  idSeleccionMensual: number | null;
  idRutaVersion: number | null;
  version: number | null;
  estadoRutaVersion: string | null;
  totalVisitas: number;
  visitasConTaller: number;
  visitasSinTaller: number;
  totalTalleres: number;
  talleresSinRecursos: number;
  talleresSinCosto: number;
  talleresFueraVersionActiva: number;
  talleresExtraordinarios: number;
  solicitudesPendientes: number;
  visitasSinTallerDetalle: VisitaSinTaller[];
  advertencias: AdvertenciaMatriz[];
}

export interface VisitaSinTaller {
  idRutaVisita: number;
  idRuta: number;
  idHospital: number | null;
  hospital: string | null;
  region: string | null;
  fechaVisita: string;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  estadoRuta: string | null;
}

export interface AdvertenciaMatriz {
  codigo: string;
  severidad: 'info' | 'warning' | 'error' | string;
  mensaje: string;
  total: number;
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
  ajustesPostCierre: MatrizAjustePostCierre[];
}
