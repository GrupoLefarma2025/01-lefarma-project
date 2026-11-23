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
  esAlmacen: boolean | null;
  esFarmacia: boolean | null;
  esSedeTaller: boolean | null;
  mostrarEducacionMedica: boolean;
  motivoClasificacion: string | null;
  requiereRevision: boolean;
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
  tieneCoordenadas?: boolean | null;
  filtroSede?: string;
  mostrarEducacionMedica?: boolean | null;
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
  tieneRutas: boolean;
  fechaCreacion: string;
  idWorkflow: number | null;
  idPasoActual: number | null;
  idEstado: number | null;
  estadoNombre: string | null;
  estadoColor: string | null;
  pasoActualNombre: string | null;
  nombreUsuarioCreacion: string | null;
  acciones: AccionDisponible[];
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
  idEquipo: number | null;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  scoreSugerencia: number | null;
  origen: string | null;
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
  datosAdicionales?: Record<string, unknown> | null;
}

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
  datosSnapshot?: string | null;
  fechaEvento: string;
}

export interface PendienteAprobacion {
  tipo: 'seleccion' | 'matriz';
  idEntidad: number;
  idSeleccionMensual: number;
  idMatrizGeneral?: number | null;
  idWorkflow: number | null;
  idPasoActual: number | null;
  documento: string;
  detalle: string | null;
  idUsuarioCreador: number | null;
  nombreUsuarioCreador: string | null;
  pasoNombre: string | null;
  estado: string | null;
  idEstado: number | null;
  estadoNombre: string | null;
  estadoColor: string | null;
  fecha?: string | null;
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
  horaSalida?: string | null;
  horaLlegada?: string | null;
  esForanea: boolean;
  esExtraordinaria?: boolean;
  idRegion: number | null;
  nombreRegion: string | null;
  entidadFederativa?: string | null;
  ciudadMunicipio?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  aviso?: string | null;
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
  horaSalida?: string | null;
  horaLlegada?: string | null;
  idHospital: number | null;
  nombreHospital: string | null;
  nombreRegion: string | null;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  institucion: string | null;
  esExtraordinaria?: boolean;
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
  motivo?: string | null;
}

export interface AgregarVisitaRequest {
  idSeleccionHospital: number;
  fechaVisita: string;
  orden: number;
  motivo?: string | null;
}

export interface EditarHorasVisitaRequest {
  horaSalida?: string | null;
  horaLlegada?: string | null;
  motivo?: string | null;
}

export interface VisitaExtraordinariaRequest {
  idEquipo: number;
  idHospital: number;
  fechaVisita: string;
  orden?: number | null;
  motivo: string;
}

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

export type TipoRecursoTaller = 'Producto' | 'Folleto' | 'Envio' | 'BoxLunch';

export interface TallerRecurso {
  idTallerRecurso: number;
  tipoRecurso: string;
  idProducto: string | null;
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
  fechaTaller: string | null;
  horaTaller: string | null;
  requiereEquipoProyeccion: boolean | null;
  tipoEquipoProyeccion: string | null;
  estado: string;
  observaciones: string | null;
  tema?: string | null;
  idMatrizIndividual: number | null;
  idMatrizGeneral: number | null;
  fechaRealizado?: string | null;
  esExtraordinario?: boolean;
  motivoExtraordinario?: string | null;
  idUsuarioCreacion?: number | null;
  capturadoPor?: string | null;
  solicitudCambioPendiente?: TallerSolicitudCambioResumen | null;
  recursos: TallerRecurso[];
  costoTotal: number;
}

export interface MatrizIndividual {
  idMatrizIndividual: number;
  idEquipo: number;
  periodo: string;
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  totalTalleres: number;
}

export interface MisTalleresResponse {
  idEquipo: number | null;
  nombreRegion: string | null;
  nombreEjecutivo: string | null;
  nombreEspecialista: string | null;
  periodo: string;
  matriz: MatrizIndividual | null;
  estadoMatrizGeneral: string | null;
  estadoMatrizGeneralColor: string | null;
  pasoActualMatrizGeneral: string | null;
  talleres: Taller[];
}

export interface DashboardResumen {
  periodo: string;
  misTalleres: MisTalleresResponse | null;
  asignaciones: Asignacion[];
  pendientes: PendienteAprobacion[];
  matrices: MatrizGeneralResumen[];
  talleresPeriodo: Taller[];
  solicitudes: Taller[];
}

export interface GuardarTallerRecursoRequest {
  tipoRecurso: string;
  idProducto?: string | null;
  descripcion?: string | null;
  tipoEnvio?: string | null;
  cantidad?: number | null;
  observaciones?: string | null;
}

export interface CrearTallerRequest {
  idTipoVisita?: number | null;
  idRutaVisita?: number | null;
  idSeleccionHospital?: number | null;
  idEquipo?: number | null;
  esExtraordinario?: boolean;
  idHospital?: number | null;
  motivoExtraordinario?: string | null;
  numeroParticipantes?: number | null;
  unidadMedica?: string | null;
  lugar?: string | null;
  fechaTaller?: string | null;
  horaTaller?: string | null;
  motivoAjuste?: string | null;
  requiereEquipoProyeccion?: boolean | null;
  tipoEquipoProyeccion?: string | null;
  observaciones?: string | null;
  tema?: string | null;
  recursos?: GuardarTallerRecursoRequest[] | null;
}

export interface ActualizarTallerRequest {
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
  motivo?: string | null;
  recursos?: GuardarTallerRecursoRequest[] | null;
}

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

export interface TallerDocumentoMaterial {
  taller: Taller;
  material: TallerMaterial | null;
}

export interface TallerDocumentoAsistencia {
  taller: Taller;
  asistencias: TallerAsistencia[];
}

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

export interface GuardarCostoRecursoRequest {
  tipoRecurso: string;
  idProducto?: string | null;
  descripcion?: string | null;
  tipoEnvio?: string | null;
  cantidad?: number | null;
  costoUnitario?: number | null;
  observaciones?: string | null;
}

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
